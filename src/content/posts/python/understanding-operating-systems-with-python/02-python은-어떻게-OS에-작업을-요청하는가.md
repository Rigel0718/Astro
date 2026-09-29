---
title: "02. Python은 어떻게 OS에 작업을 요청하는가"
description: "Python의 os.read()를 예시로 System Call의 동작 원리와 사용자 공간, 커널 공간, CPU의 실행 모드 전환 과정을 이해합니다."
pubDatetime: 2026-09-29T09:10:00+09:00
tags:
  - Python
  - Python으로 이해하는 운영체제
  - System Call
  - User Mode
  - Kernel Mode
draft: False
---

01편에서는 운영체제가 프로그램을 실행하고 관리하는 방식과 Python 인터프리터가 프로세스로 실행되는 과정을 살펴봤다.

일반적인 Python 프로그램은 User Mode에서 실행되며, 커널의 서비스가 필요하면 System Call을 사용한다.

그렇다면 Python 코드에서 시스템 호출은 구체적으로 어떻게 일어날까?

예를 들어 다음과 같은 코드를 살펴보자.

```python
import os

fd = os.open("example.txt", os.O_RDONLY)
data = os.read(fd, 100)
os.close(fd)
```

`os.read()`는 열린 파일에서 최대 100바이트의 데이터를 읽는 함수다.

하지만 Python 프로그램이 직접 저장장치를 제어해서 데이터를 가져오는 것은 아니다. 운영체제가 제공하는 기능을 이용한다.

이번 편에서는 `os.read()`를 예시로 Python 프로그램이 시스템 호출을 통해 커널에 작업을 요청하고, 그 결과를 돌려받는 과정을 살펴본다.

---

## 1. Python에서 OS의 기능을 사용하는 방법

Python은 운영체제의 여러 기능을 사용할 수 있도록 `os` 모듈을 제공한다.

대표적인 함수는 다음과 같다.

| Python 함수 | 기능 |
|---|---|
| `os.getpid()` | 현재 프로세스의 PID 조회 |
| `os.open()` | 파일 열기 |
| `os.read()` | 파일에서 데이터 읽기 |
| `os.write()` | 파일에 데이터 쓰기 |
| `os.close()` | 열린 FD 닫기 |

Linux에서 이러한 함수들은 일반적으로 운영체제가 제공하는 시스템 호출 인터페이스를 이용한다.

다만 Python 함수와 시스템 호출이 항상 일대일로 대응하는 것은 아니다.

Python 함수는 운영체제별 라이브러리나 여러 내부 처리 과정을 거칠 수 있으며, 실제로 어떤 시스템 호출이 사용되는지는 운영체제와 구현에 따라 달라진다.

이번 편에서는 Linux에서 `os.read()`가 파일 읽기를 요청하는 일반적인 과정을 중심으로 살펴본다.

---

## 2. 사용자 공간과 커널 공간

시스템 호출의 동작 과정을 이해하려면 사용자 공간(User Space)과 커널 공간(Kernel Space)을 구분해야 한다.

### 사용자 공간

사용자 공간은 일반적인 사용자 프로세스가 사용하는 가상 주소 공간의 영역이다.

Python 인터프리터와 Python 객체, 프로그램의 실행 데이터 등은 일반적으로 사용자 공간에 위치한다.

프로세스는 자신에게 허용된 사용자 공간 메모리에 접근할 수 있지만, 보호된 커널 메모리에 임의로 접근할 수는 없다.

### 커널 공간

커널 공간은 커널 코드와 데이터 등이 위치하는 보호된 가상 주소 공간의 영역이다.

커널은 이 영역을 사용하면서 프로세스 관리, 메모리 관리, 파일 시스템, 장치 제어 등의 기능을 수행한다.

사용자 공간과 커널 공간은 메모리 접근 권한을 기준으로 구분된다.

### User Mode와 Kernel Mode의 차이

여기서 사용자 공간과 User Mode는 서로 다른 개념이라는 점에 주의해야 한다.

- 사용자 공간과 커널 공간은 가상 메모리의 영역을 구분한다.
- User Mode와 Kernel Mode는 CPU의 실행 권한을 구분한다.

일반적인 Python 프로그램은 User Mode에서 실행되면서 사용자 공간의 메모리를 사용한다.

시스템 호출을 통해 커널의 서비스를 요청하면 CPU는 Kernel Mode로 전환되어 커널 코드를 실행할 수 있다.

이때 시스템 호출을 요청한 사용자 프로세스의 실행 문맥에서 커널 코드가 실행될 수 있다. 별도의 커널 프로세스를 생성해야 하는 것은 아니다.

---

## 3. System Call은 어떻게 동작하는가?

System Call은 사용자 프로그램이 커널에 운영체제 서비스를 요청하기 위한 인터페이스다.

Linux에서 `os.read()`를 호출하는 과정을 단순화하면 다음과 같다.

<img
  class="dark:hidden"
  src="/Astro/diagrams/system-call-sequence-light.svg"
  alt="Python os.read 호출이 Linux 커널의 파일 시스템 처리와 모드 전환을 거쳐 결과를 반환하는 순서도"
/>
<img
  class="hidden dark:block"
  src="/Astro/diagrams/system-call-sequence-dark.svg"
  alt="Python os.read 호출이 Linux 커널의 파일 시스템 처리와 모드 전환을 거쳐 결과를 반환하는 순서도"
/>

<details>
<summary>다이어그램 원본 보기 (Mermaid)</summary>

```text
sequenceDiagram
    participant P as Python Program
    participant K as Linux Kernel
    participant F as File System

    P->>K: read(fd, 100)
    Note over P,K: User Mode → Kernel Mode
    activate K
    K->>F: 파일 읽기 처리
    F-->>K: 읽은 데이터
    K-->>P: 결과 반환
    deactivate K
    Note over P,K: Kernel Mode → User Mode
```

</details>

여기서 File System은 커널 내부의 파일 시스템 처리 과정을 별도의 참여자로 표현한 것이다. 별도의 프로세스를 의미하지는 않는다.

또한 이 그림은 시스템 호출의 개념적 흐름을 나타낸다. 실제 파일 읽기에서는 페이지 캐시, 파일 시스템, 장치 드라이버 등 여러 요소가 관여할 수 있다.

각 단계를 살펴보자.

### 3.1. Python 함수 호출

먼저 Python 프로그램에서 다음 코드를 실행한다.

```python
data = os.read(fd, 100)
```

Python 인터프리터는 `os.read()`에 해당하는 내부 구현을 실행한다.

CPython의 경우 이러한 기능은 일반적으로 C로 구현되어 있으며, 운영체제가 제공하는 인터페이스를 통해 파일 읽기를 요청한다.

이 단계에서 Python 함수 호출이 시스템 호출로 이어진다.

### 3.2. System Call 진입

일반적인 함수 호출과 시스템 호출은 다르다.

일반적인 함수 호출은 같은 실행 모드에서 다른 함수의 코드를 실행할 수 있다.

반면 시스템 호출은 커널이 제공하는 보호된 기능을 실행하기 위해 CPU의 실행 권한을 전환해야 한다.

예를 들어 Linux의 x86-64 환경에서는 `syscall` 명령어를 사용해 커널의 시스템 호출 진입 지점으로 이동할 수 있다.

이 과정에서 CPU는 User Mode에서 Kernel Mode로 전환된다.

커널은 시스템 호출 번호와 전달된 인자를 확인해 요청된 작업을 처리한다.

구체적인 진입 방식은 CPU 아키텍처와 운영체제에 따라 달라질 수 있다.

### 3.3. 커널의 요청 처리

Kernel Mode로 진입한 뒤 커널은 요청된 시스템 호출을 처리한다.

파일 읽기의 경우 커널은 전달받은 FD를 바탕으로 열린 파일을 확인하고, 읽을 수 있는 데이터가 있는지 확인한다.

필요한 데이터가 페이지 캐시에 있다면 저장장치에 새롭게 접근하지 않고 데이터를 가져올 수도 있다.

반대로 데이터가 준비되지 않았다면 저장장치의 I/O 처리가 필요할 수 있다.

이 과정에서 커널은 요청된 데이터를 사용자 공간의 버퍼로 복사하고, 읽은 바이트 수 또는 오류 정보를 반환할 수 있도록 준비한다.

FD가 구체적으로 어떤 자료구조를 통해 파일과 연결되는지는 03편에서 살펴본다.

### 3.4. 결과 반환

커널이 요청을 처리하면 시스템 호출의 결과를 반환한다.

CPU는 적절한 반환 절차를 거쳐 User Mode로 돌아가고, Python 인터프리터는 반환된 결과를 처리한다.

예를 들어 `os.read()`가 성공하면 Python은 읽은 데이터를 `bytes` 객체로 반환한다.

```python
data = os.read(fd, 100)

print(data)
```

시스템 호출에서 오류가 발생하면 Python은 반환된 오류 정보를 바탕으로 `OSError`와 같은 예외를 발생시킬 수 있다.

이렇게 Python 프로그램은 커널에 작업을 요청하고 결과를 전달받는다.

---

## 4. Python으로 System Call 확인하기

지금까지 살펴본 시스템 호출을 실제로 관찰해 보자.

Linux에서는 `strace`를 사용해 프로세스가 실행하는 시스템 호출을 확인할 수 있다.

다음 Python 코드를 작성한다.

```python
# main.py

import os

fd = os.open("example.txt", os.O_RDONLY)

data = os.read(fd, 100)

os.close(fd)

print(data)
```

먼저 `example.txt` 파일을 준비한다.

```bash
echo "Hello, System Call!" > example.txt
```

이제 `strace`를 사용해 Python 프로그램을 실행한다.

```bash
strace -e trace=openat,read,close python main.py
```

`-e trace` 옵션은 관찰할 시스템 호출을 지정한다.

실행 결과에서는 다음과 비슷한 내용을 확인할 수 있다.

```text
openat(AT_FDCWD, "example.txt", O_RDONLY|O_CLOEXEC) = 3
read(3, "Hello, System Call!\n", 100) = 20
close(3) = 0
```

위 출력은 이해를 위해 관련 호출만 추린 예시다. 실제 출력에는 Python 인터프리터 초기화와 모듈 로딩 과정에서 발생하는 다른 시스템 호출도 나타날 수 있다. 시스템 환경에 따라 호출 방식과 결과도 달라질 수 있다.

여기서 `read()`를 살펴보자.

```text
read(3, "Hello, System Call!\n", 100) = 20
```

첫 번째 인자인 `3`은 열린 파일을 가리키는 FD다.

두 번째 항목은 읽은 데이터이고, 세 번째 인자인 `100`은 요청한 최대 바이트 수다.

마지막의 `20`은 실제로 읽은 바이트 수를 의미한다.

이를 통해 Python의 `os.read()` 호출이 Linux의 `read` 시스템 호출로 이어지는 것을 확인할 수 있다.

참고로 `strace`는 Linux에서 사용하는 도구다. Windows나 macOS에서는 동일한 명령어를 그대로 사용할 수 없다.

---

## 5. Python 함수 호출과 System Call의 차이

지금까지 살펴본 내용을 바탕으로 두 개념을 구분해 보자.

| 구분 | 일반적인 Python 함수 호출 | System Call |
|---|---|---|
| 목적 | 프로그램 내부의 기능 실행 | 커널 서비스 요청 |
| 실행 주체 | Python 인터프리터 | 운영체제 커널 |
| 실행 모드 | 일반적으로 User Mode 유지 | Kernel Mode로 전환 |
| 예시 | 사용자 정의 Python 함수 | Linux의 `read`, `write` 등 |

일반적인 Python 함수 호출은 시스템 호출 없이 실행될 수 있다.

예를 들어 단순한 정수 연산이나 리스트의 요소에 접근하는 작업은 일반적으로 커널에 별도의 시스템 호출을 요청할 필요가 없다.

반면 파일 읽기처럼 커널의 서비스가 필요한 작업에서는 시스템 호출이 사용된다.

다만 Python 함수 내부에서 시스템 호출이 발생할 수도 있으므로 두 개념이 완전히 분리되어 있는 것은 아니다.

---

## 6. 정리

이번 편에서는 Python 프로그램이 시스템 호출을 통해 운영체제의 기능을 사용하는 과정을 살펴봤다.

핵심 내용을 정리하면 다음과 같다.

1. 사용자 공간과 커널 공간은 가상 메모리의 영역을 구분하며, User Mode와 Kernel Mode는 CPU의 실행 권한을 구분한다.
2. System Call은 사용자 프로그램이 커널에 운영체제 서비스를 요청하기 위한 인터페이스다.
3. 시스템 호출을 실행하면 CPU가 Kernel Mode로 전환되어 커널 코드를 실행할 수 있다.
4. 커널이 요청을 처리하고 결과를 반환하면 프로그램은 User Mode에서 실행을 이어간다.
5. Linux에서는 `strace`를 사용해 Python 프로그램이 실행하는 시스템 호출을 관찰할 수 있다.

이제 Python 프로그램이 커널에 작업을 요청하는 기본적인 과정을 이해했다.

그런데 파일 읽기 예시에서 사용했던 `fd`는 정확히 무엇일까?

커널은 단순한 정수인 FD만 전달받고도 어떤 파일을 읽어야 하는지 어떻게 알 수 있을까?

다음 편에서는 **File Descriptor의 개념과 FD 테이블, 파일을 열고 읽고 닫는 과정**을 살펴본다.
