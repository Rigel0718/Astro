---
title: "11. GIL은 Python의 Thread 실행에 어떤 영향을 주는가"

description: "전통적인 CPython의 GIL이 Python Thread의 Bytecode 실행을 어떻게 제한하는지 살펴보고, CPU-bound와 I/O-bound 작업, Native Code, free-threaded CPython까지 이해합니다."

pubDatetime: 2026-09-11T16:25:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - GIL
  - Thread
  - CPython
  - free-threaded Python

draft: false
---

앞선 글에서는 Python에서 Thread가 어떻게 실행되는지 살펴봤다.

```text
Process
   ↓
OS Thread
   ↓
Python Thread
   ↓
OS Scheduling
   ↓
Context Switching
   ↓
Shared Memory
   ↓
Concurrency
```

Python의 `threading.Thread`는 Python 내부에만 존재하는 가상의 실행 단위가 아니다.

CPython에서 Python Thread는 일반적으로 **운영체제가 관리하는 실제 OS Thread와 연결되어 실행된다.**

그리고 어떤 Thread를 CPU에서 실행할지는 OS Scheduler가 결정한다.

```text
OS Scheduler
     ↓
Thread A 실행
     ↓
Context Switch
     ↓
Thread B 실행
```

여기까지가 앞선 글에서 살펴본 **OS Thread의 실행**에 관한 이야기였다.

그렇다면 CPU Core가 여러 개이고 OS Thread도 여러 개라면 Python 코드 역시 여러 Core에서 동시에 실행할 수 있지 않을까?

전통적인 CPython에서는 여기서 한 가지 중요한 제약이 등장한다.

바로 **GIL(Global Interpreter Lock)**이다.

이번 글에서는 OS의 Thread Scheduling과 CPython의 GIL을 명확히 구분하면서, GIL이 Python Thread 실행에 어떤 영향을 주는지 살펴본다.

---
## 1. 먼저 OS Thread와 GIL을 구분하자

GIL을 이해할 때 가장 먼저 구분해야 하는 것이 있다.

```text
Thread Scheduling / Context Switching
                ≠
        GIL acquire / release
```

둘은 서로 다른 Layer에서 일어나는 일이다.

### OS의 역할

운영체제는 **어떤 Thread를 CPU에서 실행할 것인지** 결정한다.

```text
┌──────────────────────────────┐
│ OS                           │
│                              │
│ Scheduler                    │
│ Context Switching            │
│                              │
│ Thread A ↔ Thread B          │
└──────────────────────────────┘
```

Thread A를 실행하다가 Thread B로 바꾸는 것은 OS의 **Context Switching**이다.

이것은 Python만의 특징이 아니다.

OS Thread를 사용하는 프로그램이라면 다른 언어에서도 일어날 수 있다.

### CPython의 역할

반면 전통적인 CPython에는 GIL이라는 Lock이 존재한다.

```text
┌──────────────────────────────┐
│ CPython                      │
│                              │
│ GIL                          │
│ acquire / release            │
│                              │
│ Python Bytecode 실행 권한    │
└──────────────────────────────┘
```

GIL은 **어떤 Thread가 Python Bytecode를 실행할 수 있는가**와 관련된다.

따라서 전체 구조를 나누면 다음과 같다.

```text
┌──────────────────────────────┐
│ OS                           │
│                              │
│ CPU Scheduling               │
│ Context Switching            │
│                              │
│ Thread A ↔ Thread B          │
└──────────────┬───────────────┘
               │
         OS Thread 실행
               │
┌──────────────▼───────────────┐
│ CPython                      │
│                              │
│ GIL acquire / release        │
│                              │
│ Python Bytecode 실행         │
└──────────────────────────────┘
```

즉,

> **OS는 어떤 Thread가 CPU에서 실행될지를 관리하고, 전통적인 CPython의 GIL은 그 Thread가 Python Bytecode를 실행할 수 있는지를 제한한다.**

이 둘을 구분하는 것이 GIL을 이해하는 출발점이다.

---
## 2. GIL이란 무엇인가?

GIL은 **Global Interpreter Lock**의 약자다.

전통적인 CPython에서는 여러 Thread가 존재하더라도 **한 순간에 하나의 Thread만 GIL을 가지고 Python Bytecode를 실행할 수 있다.**

예를 들어 하나의 Process 안에 세 개의 OS Thread가 있고, 각각이 Python 코드를 실행한다고 해보자.

```
Process
│
├── OS Thread A
├── OS Thread B
└── OS Thread C
```

이 Thread들은 운영체제가 관리하는 실제 실행 단위다.

OS는 이 Thread들을 CPU에 스케줄링한다.

하지만 CPython에서 Python Bytecode를 실행하려면 추가적인 조건이 필요하다.

```
OS Thread
    ↓
CPython
    ↓
GIL acquire
    ↓
Python Bytecode 실행 가능
```

예를 들어 Thread A가 GIL을 가지고 있다면 다음과 같다.

```
Thread A ── GIL 보유 ──→ Python Bytecode 실행

Thread B ── GIL 없음 ──→ Python Bytecode 실행 불가
Thread C ── GIL 없음 ──→ Python Bytecode 실행 불가
```

따라서 OS Thread가 여러 개 존재한다는 사실만으로 Python Bytecode가 동시에 실행되는 것은 아니다.

전통적인 CPython에서는 GIL이라는 추가적인 제약이 존재한다.

---
## 3. 왜 CPython에는 GIL이 존재하는가?

GIL을 이해하려면 앞선 「Python 객체에 대한 이해」에서 살펴본 CPython 객체 구조를 다시 떠올려볼 필요가 있다.

CPython 객체의 기본 구조에는 개념적으로 다음과 같은 정보가 존재한다.

```
PyObject
├── ob_refcnt
└── ob_type
```

특히 `ob_refcnt`, 즉 **Reference Count**를 예로 들어보자.

CPython은 어떤 객체를 몇 개의 Reference가 가리키고 있는지 추적한다.

```
a = []
b = a
```

개념적으로는 다음과 같다.

```
a ──┐
    ├──→ list object
b ──┘
```

Reference가 추가되거나 제거되면 CPython은 Reference Count를 변경해야 한다.

그런데 여러 Thread가 동시에 Python 객체와 Interpreter 내부 자료구조를 변경할 수 있다고 생각해보자.

```
Thread A ──→ Python Object ←── Thread B
```

동시에 같은 상태를 수정한다면 동기화 문제가 발생할 수 있다.

Reference Count는 이러한 문제를 이해하기 좋은 **대표적인 예시**다.

GIL이 단순히 Reference Count 하나만을 보호하기 위해 존재하는 것은 아니다.

Python 객체와 메모리 관리, Interpreter 내부의 여러 자료구조에서도 여러 Thread의 동시 접근을 안전하게 처리해야 한다.

이를 해결하는 한 가지 방법은 여러 내부 자료구조에 세밀하게 Lock을 적용하는 것이다.

```
Object A        → synchronization
Object B        → synchronization
Container       → synchronization
Reference Count → synchronization
Memory          → synchronization
```

하지만 이런 방식은 구현을 훨씬 복잡하게 만든다.

전통적인 CPython은 오랫동안 보다 큰 단위의 Lock을 사용하는 방식을 선택해왔다.

```
여러 OS Thread
      ↓
     GIL
      ↓
CPython Interpreter
```

즉 여러 Thread가 Interpreter 내부 상태에 동시에 접근하는 상황을 크게 제한하는 것이다.

그 결과 CPython 내부 구현과 메모리 관리의 많은 부분을 비교적 단순하게 유지할 수 있었다.

하지만 그 대가로 **여러 Thread가 Python Bytecode를 병렬로 실행하기 어려워졌다.**

---
## 4. Thread가 여러 개인데 왜 Python 코드는 병렬 실행되지 않는가?

다음과 같은 코드를 생각해보자.

```python
import threading

def work():
    for _ in range(100_000_000):
        pass

t1 = threading.Thread(target=work)
t2 = threading.Thread(target=work)

t1.start()
t2.start()

t1.join()
t2.join()
```

Python에서는 `threading.Thread`를 통해 Thread를 다룬다.

```
threading.Thread
       ↓
   OS Thread
```

CPython에서 이러한 Python 레벨의 Thread는 일반적으로 운영체제가 관리하는 실제 OS Thread와 연결되어 실행된다.

따라서 OS 관점에서는 실제로 두 개의 Thread가 존재한다.

```
Process
│
├── OS Thread A
└── OS Thread B
```

여러 CPU Core가 있다면 OS는 Thread들을 서로 다른 Core에 스케줄링할 수도 있다.

```
Core 1 ← OS Thread A
Core 2 ← OS Thread B
```

하지만 여기서 중요한 것은 **CPU에 스케줄링되었다는 것과 Python Bytecode를 실행할 수 있다는 것이 같은 의미가 아니라는 점**이다.

전통적인 CPython에서 Python Bytecode를 실행하려면 GIL이 필요하다.

예를 들어 Thread A가 GIL을 가지고 있다면:

```
Core 1
  ↓
OS Thread A
  ↓
GIL 보유
  ↓
Python Bytecode 실행
```

Thread B는 OS Thread로 존재하고 CPU 시간을 얻더라도 GIL 없이 Python Bytecode를 동시에 실행할 수 없다.

```
Core 2
  ↓
OS Thread B
  ↓
GIL 없음
  ↓
Python Bytecode 실행 불가
```

그래서 전통적인 CPython에서는 여러 Thread가 있어도 **순수 Python Bytecode의 멀티코어 병렬 실행이 제한된다.**

---
## 5. GIL acquire/release와 Context Switching은 같은 것이 아니다

여기서 특히 조심해야 할 부분이 있다.

다음 두 가지를 같은 사건으로 이해하면 안 된다.

```text
GIL release
    ≠
OS Context Switch
```

GIL을 해제하는 것은 **CPython 내부 Lock의 소유권을 내려놓는 것**이다.

```text
Thread A
   ↓
release GIL
```

Context Switch는 **OS가 CPU에서 실행 중인 Thread를 다른 Thread로 바꾸는 것**이다.

```text
Thread A
   ↓
OS Scheduler
   ↓
Context Switch
   ↓
Thread B
```

따라서 다음처럼 이해해서는 안 된다.

```text
Thread A
   ↓
release GIL
   ↓
Thread B로 Context Switch
```

GIL을 해제했다고 해서 그 행위 자체가 곧바로 OS Context Switch를 의미하는 것은 아니다.

반대로 OS가 Thread를 스케줄링한다고 해서 그 Thread가 자동으로 GIL을 획득하는 것도 아니다.

둘의 관계를 정확하게 표현하면 다음과 같다.

```text
OS
│
├── Thread를 CPU에 Scheduling
└── 필요하면 Context Switching
          │
          ↓
       Thread 실행
          │
          ↓
CPython
│
├── GIL이 필요한가?
│
└── 필요하다면 acquire
          │
          ↓
   Python Bytecode 실행
```

즉,

```text
OS Thread 실행 여부
        +
CPython GIL 보유 여부
        ↓
Python Bytecode 실행 가능
```

이라고 이해하는 것이 좋다.

---
## 6. 그렇다면 GIL은 언제 acquire/release 되는가?

전통적인 CPython에서 Thread가 Python Bytecode를 실행하려면 GIL을 가지고 있어야 한다.

개념적으로는 다음과 같다.

```text
Thread
   ↓
acquire GIL
   ↓
Python Bytecode 실행
```

하지만 하나의 Thread가 프로그램이 종료될 때까지 GIL을 독점하는 것은 아니다.

다른 Thread도 실행 기회를 얻을 수 있도록 CPython은 실행 중인 Thread가 GIL을 계속 무한정 보유하지 않도록 한다.

개념적으로 보면:

```text
Thread A
   ↓
GIL 획득
   ↓
Python 실행
   ↓
GIL 해제

       ...

Thread B
   ↓
GIL 획득
   ↓
Python 실행
```

여기서 중요한 것은 가운데의 `...`이다.

Thread A가 GIL을 해제했다고 해서 **Thread B가 즉시 CPU에서 실행된다는 의미는 아니다.**

실제로 어떤 Thread가 CPU 시간을 얻는지는 OS Scheduling의 영역이고, 그 Thread가 Python Bytecode를 실행하기 위해 GIL을 획득하는 것은 CPython의 영역이다.

따라서:

```text
GIL 소유권 전환
        ≠
OS Thread 전환
```

이다.

실제 실행에서는 둘이 서로 영향을 주며 연속해서 관찰될 수 있지만 **개념적으로는 반드시 분리해서 이해해야 한다.**

---
## 7. CPU-bound 작업에서 GIL의 영향

이제 이 구분을 가지고 CPU-bound 작업을 생각해보자.

CPU-bound는 대부분의 시간을 CPU 계산에 사용하는 작업이다.

예를 들면:

```text
수학 계산
대규모 Python 반복문
데이터 변환
순수 Python으로 구현한 계산
```

이런 작업은 계속 Python Bytecode를 실행해야 한다.

```text
Thread A
   ↓
GIL 획득
   ↓
Python Bytecode
   ↓
Python Bytecode
   ↓
Python Bytecode
```

Thread B도 같은 계산을 하고 있다고 하자.

```text
Thread A ──┐
           │
           ├──→ GIL ──→ Python Bytecode
           │
Thread B ──┘
```

전통적인 CPython에서는 두 Thread가 동시에 GIL을 가지고 순수 Python Bytecode를 실행할 수 없다.

따라서 Thread를 두 개 만든다고 해서:

```text
Core 1 → Python Thread A
Core 2 → Python Thread B
```

처럼 Python 계산이 그대로 두 배의 병렬성을 얻는 것은 아니다.

오히려 GIL 경쟁과 OS Thread Scheduling, Context Switching 등의 추가 비용이 발생할 수도 있다.

그래서 CPU-bound 작업에서 실제 멀티코어 병렬 처리가 필요하다면 여러 Process를 사용하는 방법을 흔히 고려한다.

```text
Process A
├── Interpreter A
└── GIL A
       ↓
     Core 1


Process B
├── Interpreter B
└── GIL B
       ↓
     Core 2
```

각 Process는 독립적인 Interpreter 실행 환경을 가지므로 하나의 Process 안에서 발생하는 전통적인 GIL 제약을 서로 공유하지 않는다.

그래서 `multiprocessing`이나 `ProcessPoolExecutor`가 CPU-bound 작업에서 사용되곤 한다.

---
## 8. I/O-bound 작업에서는 이야기가 달라진다

이번에는 다음과 같은 작업을 생각해보자.

```text
HTTP 요청
DB Query
파일 읽기
Socket 통신
```

이런 작업은 대부분의 시간 동안 CPU가 Python 코드를 계산하는 것이 아니다.

외부 작업의 결과를 기다리는 시간이 길다.

```text
Python 실행
   ↓
HTTP 요청
   ↓
Network waiting
   ↓
응답 도착
   ↓
Python 실행
```

Blocking I/O를 수행하는 동안 CPython이나 관련 Native 코드가 GIL을 해제할 수 있다.

```text
Thread A
   ↓
I/O 요청
   ↓
release GIL
   ↓
I/O waiting
```

이제 다른 Thread가 Python 코드를 실행할 기회를 얻을 수 있다.

```text
Thread A
└── I/O waiting

Thread B
└── GIL 획득
      ↓
   Python 실행
```

전체 흐름은 개념적으로 다음처럼 보일 수 있다.

```text
time ─────────────────────────────────→

Thread A  [Python][------ I/O ------][Python]
Thread B          [Python][--- I/O ---]
Thread C                   [Python][--- I/O ---]
```

한 Thread가 I/O를 기다리는 동안 다른 Thread가 Python 코드를 실행할 수 있기 때문에 GIL이 존재하더라도 **I/O-bound 작업에서는 Thread가 충분히 유용할 수 있다.**

그리고 여기서도 두 Layer를 구분해야 한다.

```text
I/O 대기 중 GIL 해제
→ CPython의 동작

다른 Thread를 CPU에서 실행
→ OS Scheduling
```

둘이 협력하면서 전체적인 동시성이 만들어지는 것이다.

---
## 9. CPU-bound와 I/O-bound를 비교해보자

이제 GIL의 영향을 비교하면 훨씬 명확하다.

```text
                    Python Thread
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
          CPU-bound               I/O-bound
              │                       │
      Python 실행이 계속 필요      I/O 대기가 많음
              │                       │
      GIL이 계속 중요함           GIL 해제 가능
              │                       │
              ↓                       ↓
    Python 병렬 실행 제한      다른 Thread 실행 가능
```

그래서 전통적인 CPython에서 일반적으로:

```text
CPU-bound
→ Thread로 멀티코어 Python 병렬화에 불리

I/O-bound
→ Thread를 이용한 Concurrency에 유용
```

이라고 설명한다.

이것이 흔히 말하는 **"GIL 때문에 CPU-bound에는 Thread가 불리하지만 I/O-bound에는 Thread가 유용하다"** 는 말의 실제 의미다.

---
## 10. Coroutine과 비교하면 Thread의 위치가 더 명확해진다

앞에서 Coroutine과 Event Loop도 살펴봤다.

Thread와 Coroutine 모두 I/O-bound 작업의 Concurrency를 구현하는 데 사용할 수 있지만 **실행을 관리하는 주체가 다르다.**

Thread는 OS가 관리한다.

```text
Thread A
Thread B
Thread C
    ↓
OS Scheduler
    ↓
   CPU
```

따라서 Thread 사이의 실행 전환에는 OS Scheduling과 Context Switching이 관여한다.

반면 `asyncio`의 Coroutine은 Event Loop가 관리한다.

```text
Coroutine A
    ↓
  await
    ↓
Event Loop
    ↓
Coroutine B
```

Coroutine은 `await`에서 실행을 중단하고 Event Loop에 제어권을 돌려준다.

따라서 두 모델은 다음처럼 비교할 수 있다.

```text
Thread
→ OS가 실행 단위를 Scheduling
→ OS Thread Context Switching

Coroutine
→ Event Loop가 Task를 Scheduling
→ await을 기준으로 suspend / resume
```

GIL은 여기서 **OS Thread라는 실행 모델 위에서 CPython이 추가로 가지고 있는 제약**이다.

```text
OS
↓
Thread Scheduling
↓
Python Thread
↓
CPython
↓
GIL
↓
Python Bytecode
```

이렇게 놓고 보면 Thread, Event Loop, GIL이 서로 다른 Layer의 개념이라는 것이 명확해진다.

---
## 11. GIL이 모든 코드의 병렬 실행을 막는 것은 아니다

7장에서는 순수 Python으로 작성된 CPU-bound 작업을 여러 Core에서 병렬로 실행하기 위한 방법으로 여러 Process를 사용하는 방식을 살펴봤다.

```text
Process A
├── Interpreter A
└── GIL A
       ↓
     Core 1


Process B
├── Interpreter B
└── GIL B
       ↓
     Core 2
```

Process를 나누면 각각 독립적인 Interpreter와 GIL을 가질 수 있기 때문에, 순수 Python으로 작성된 CPU-bound 작업도 여러 Core에서 병렬로 실행할 수 있다.

하지만 여기서 한 가지 오해하면 안 되는 부분이 있다.

> GIL이 존재하면 하나의 Process에서는 여러 CPU Core를 사용할 수 없다.

정확히는 그렇지 않다.

GIL의 제약을 이해하려면 **OS Thread가 어떤 코드를 실행하고 있는지**까지 구분해야 한다.

```text
OS Thread
    │
    ├── Python Bytecode 실행
    │        ↓
    │     GIL 필요
    │
    └── Native Code 실행
             ↓
       구현에 따라
       GIL 없이 실행 가능
```

Python 프로그램이 실행한다고 해서 CPU에서 항상 Python Bytecode만 실행되는 것은 아니다.

Python에서는 C/C++ 등으로 구현된 Native Extension을 사용할 수 있다.

예를 들어 Python 코드에서 Native Extension의 함수를 호출하면 실행 흐름은 개념적으로 다음과 같이 이어질 수 있다.

```text
Python Bytecode
      ↓
Native Extension 호출
      ↓
Native Code 실행
```

Native Code가 실행되는 동안에도 Python 객체나 CPython의 상태를 다뤄야 한다면 GIL이 필요할 수 있다.

반대로 Python 객체에 접근할 필요가 없는 계산을 수행한다면, Native Extension은 구현에 따라 GIL을 해제하고 계산을 진행할 수 있다.

```text
OS Thread
    ↓
Python Bytecode
    ↓
Native Extension
    ↓
release GIL
    ↓
Native Code 실행
```

이렇게 GIL을 해제한 Native Code가 실행되는 동안에는 다른 OS Thread도 GIL을 획득하여 Python Bytecode를 실행할 수 있다.

```text
OS Thread A
    ↓
Native Code 실행
(GIL 없이 실행)

        동시에

OS Thread B
    ↓
GIL 획득
    ↓
Python Bytecode 실행
```

여기서 한 단계 더 나아가 Native Library 자체가 여러 Thread를 사용하도록 구현되어 있다면, 하나의 Process에서도 여러 OS Thread가 여러 CPU Core에서 Native Code를 병렬로 실행할 수 있다.

```text
              하나의 Process
                    │
          Native Library의 계산
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
     OS Thread A OS Thread B OS Thread C
          ↓         ↓         ↓
        Core 1    Core 2    Core 3
```

중요한 것은 이 Thread들이 특별한 종류의 **Native Thread**인 것이 아니라는 점이다.

여전히 운영체제가 스케줄링하는 **OS Thread**다.

다만 그 Thread에서 현재 실행되고 있는 코드가 Python Bytecode가 아니라 **Native Code**라는 차이가 있다.

```text
Thread의 종류가 다른 것이 아니다.

OS Thread
   ↓
무엇을 실행하는가?
   │
   ├── Python Bytecode
   │       ↓
   │    GIL의 제약
   │
   └── Native Code
           ↓
      구현에 따라
      GIL 없이 실행 가능
```

그래서 NumPy와 같은 Native 기반 라이브러리를 사용할 때의 실행 특성과 순수 Python 반복문을 사용할 때의 실행 특성은 다를 수 있다.

예를 들어 순수 Python으로 대량의 계산을 반복하면:

```text
Python for loop
      ↓
Python Bytecode
      ↓
GIL의 영향을 받음
```

반면 NumPy 같은 라이브러리에 대량의 수치 계산을 맡기면 실제 무거운 계산이 Native Code에서 수행될 수 있다.

```text
Python
   ↓
NumPy 연산 호출
   ↓
Native Code
   ↓
대량의 수치 계산
```

그리고 해당 Native 구현이 GIL을 해제하거나 내부적으로 여러 Thread를 사용하도록 만들어져 있다면, 순수 Python 반복문과는 다른 방식으로 CPU를 활용할 수 있다.

따라서 CPU-bound 작업을 바라볼 때는 다음 두 경우를 구분해야 한다.

```text
CPU-bound
    │
    ├── 순수 Python 계산
    │        ↓
    │   Python Bytecode
    │        ↓
    │   GIL의 제약
    │        ↓
    │   Multi-Process 고려
    │
    └── Native Library가 수행하는 계산
             ↓
         Native Code
             ↓
       구현에 따라 GIL 해제
             ↓
       하나의 Process에서도
       여러 Core 활용 가능
```

즉, GIL은 Python 프로그램에서 일어나는 **모든 CPU 연산을 하나의 Core에 묶어두는 Lock이 아니다.**

더 중요한 것은 현재 어떤 코드가 실행되고 있는가이다.

> **지금 실행되는 코드가 Python Bytecode인가, Native Code인가? 그리고 그 실행에서 GIL이 필요한가?**

이 기준을 가지고 보면 순수 Python CPU-bound 작업에서 Multi-Process를 고려하는 이유와, NumPy 같은 Native 기반 라이브러리가 하나의 Process에서도 여러 Core를 활용할 수 있는 이유를 함께 이해할 수 있다.

---
## 12. 그래서 GIL은 왜 오랫동안 유지되었는가?

GIL은 흔히 Python의 단점으로 소개된다.

실제로 명확한 단점이 있다.

```text
Multi-Core CPU
      ↓
여러 Python Thread
      ↓
      GIL
      ↓
CPU-bound Python Bytecode의
병렬 실행 제한
```

하지만 GIL이 아무 이유 없이 존재했던 것은 아니다.

전통적인 CPython은 GIL을 통해 Interpreter 내부의 많은 동시 접근 문제를 비교적 단순하게 관리할 수 있었다.

```text
GIL

장점
├── CPython 내부 동기화 복잡성 감소
├── 객체와 메모리 관리 구현 단순화
└── 기존 C Extension 생태계와의 오랜 호환성

단점
└── CPU-bound Python Thread의 병렬 실행 제한
```

따라서 GIL을 단순히

> Python을 느리게 만드는 Lock

이라고 이해하기보다는,

> **CPython이 Thread Safety와 구현 복잡성을 관리하기 위해 오랫동안 사용해온 전역적인 실행 Lock**

으로 이해하는 편이 좋다.

---
## 13. 그런데 이제 GIL이 없는 CPython도 등장하고 있다

여기서 이야기가 한 단계 더 진행된다.

최근 CPython에는 **free-threaded build**가 도입되고 있다.

Python 3.13에서 실험적으로 도입되었고, Python 3.14부터는 실험 단계를 벗어나 공식적으로 지원되는 선택적 빌드가 되었다.

```text
Python 3.13
    ↓
Free-threaded build 도입
(Experimental)

Python 3.14
    ↓
Officially Supported
    ↓
하지만 Optional
```

즉 현재 모든 CPython에서 GIL이 사라진 것은 아니다.

기존의 GIL을 사용하는 CPython과 GIL 없이 실행할 수 있는 free-threaded CPython이 함께 존재한다.

전통적인 CPython에서는:

```text
Process
│
├── OS Thread A ──┐
├── OS Thread B ──┼──→ GIL → Python 실행
└── OS Thread C ──┘
```

하나의 GIL이 여러 Thread의 Python 코드 병렬 실행을 제한했다.

반면 free-threaded CPython에서는 GIL을 비활성화하여 여러 OS Thread가 Python 코드를 병렬로 실행할 수 있다.

```text
Free-threaded CPython

Process
│
├── OS Thread A → Core 1 → Python 실행
├── OS Thread B → Core 2 → Python 실행
└── OS Thread C → Core 3 → Python 실행
```

하지만 단순히 GIL이라는 Lock 하나를 삭제하면 끝나는 문제는 아니다.

GIL이 사라지면 다음과 같은 상황이 실제로 가능해진다.

```text
OS Thread A ──→ Python Object ←── OS Thread B
```

여러 Thread가 동시에 Python 객체와 Interpreter 내부 상태에 접근할 수 있기 때문에, CPython은 GIL이 담당하던 안전성을 다른 방식으로 보장해야 한다.

이를 위해 free-threaded CPython에서는 객체에 대한 내부 Lock과 Reference Counting 방식의 변경 등 보다 세밀한 동기화 메커니즘을 사용한다.

```text
Traditional CPython

여러 OS Thread
      ↓
     GIL
      ↓
Python Object


Free-threaded CPython

여러 OS Thread
      ↓
더 세밀한 동기화
      ↓
Python Object
```


따라서:

> **free-threaded CPython은 단순히 GIL을 삭제하는 것이 아니라, GIL이 제공하던 안전성을 보다 세밀한 동기화 메커니즘으로 옮기는 변화다.**

---
## 14. 전체 구조를 다시 정리해보자

이제 Python Thread와 GIL을 하나의 그림으로 연결해보자.

먼저 운영체제가 있다.

```text
Operating System
       ↓
   Scheduler
       ↓
   OS Thread
       ↓
Context Switching
```

여기까지는 **OS의 Thread 실행 관리**다.

그 위에서 CPython이 실행된다.

```text
OS Thread
    ↓
 CPython
    ↓
   GIL
    ↓
acquire / release
    ↓
Python Bytecode
```

따라서 전체 Layer를 나누면:

```text
┌─────────────────────────────┐
│ Operating System            │
│                             │
│ Scheduler                   │
│ Context Switching           │
│ CPU Core                    │
└─────────────┬───────────────┘
              │
              ↓
┌─────────────────────────────┐
│ OS Thread                   │
│                             │
│ Thread A                    │
│ Thread B                    │
│ Thread C                    │
└─────────────┬───────────────┘
              │
              ↓
┌─────────────────────────────┐
│ CPython                     │
│                             │
│ GIL acquire / release       │
└─────────────┬───────────────┘
              │
              ↓
┌─────────────────────────────┐
│ Python Execution            │
│                             │
│ Bytecode                    │
│ Frame                       │
│ Function                    │
└─────────────────────────────┘
```

여기서 각각의 질문도 다르다.

```text
OS Scheduler
→ 어떤 Thread를 CPU에서 실행할 것인가?

Context Switching
→ CPU의 실행 대상을 어떻게 바꿀 것인가?

GIL
→ 어떤 Thread가 Python Bytecode를 실행할 수 있는가?
```

이 세 가지를 분리해서 이해하면 Python Thread의 실행 구조가 훨씬 명확해진다.

---
## 15. 지금까지의 Python 실행 과정을 하나로 연결해보자

이제 이번 시리즈 전체를 처음부터 연결할 수 있다.

우리가 작성한 Python Source Code는 먼저 Token으로 나뉘고 AST가 된다.

```text
Source Code
    ↓
Token
    ↓
Parser
    ↓
AST
```

AST는 Compiler를 거쳐 Code Object와 Bytecode가 된다.

```text
AST
 ↓
Compiler
 ↓
Code Object
 ↓
Bytecode
```

Interpreter는 Bytecode를 읽어 실행한다.

```text
Bytecode
   ↓
Python VM
   ↓
Opcode
   ↓
Evaluation Loop
```

실행 중인 상태는 Frame에 담긴다.

```text
Code Object
    ↓
Frame
├── namespace
├── operand stack
└── instruction pointer
```

함수를 호출하면 새로운 실행 상태가 만들어진다.

```text
Function Object
    ↓
Code Object
    ↓
argument binding
    ↓
Frame
    ↓
execution
```

Iterator는 `next()`를 통해 값을 하나씩 꺼내고, Generator는 `yield`에서 실행을 중단했다가 다시 이어갈 수 있다.

```text
Iterator
   ↓
next()
   ↓
value


Generator
   ↓
yield
   ↓
suspend
   ↓
resume
```

Coroutine은 `await`에서 실행을 중단할 수 있다.

```text
Coroutine
   ↓
await
   ↓
suspend
   ↓
resume
```

Event Loop는 여러 Coroutine을 Task로 관리하면서 실행 가능한 작업을 Scheduling한다.

```text
Coroutine
   ↓
Task
   ↓
Future
   ↓
Event Loop
   ↓
Scheduling
```

Thread를 사용하면 하나의 Process 안에 여러 OS Thread라는 실행 흐름을 만들 수 있다.

```text
Process
   ↓
OS Thread
   ↓
OS Scheduling
   ↓
Context Switching
   ↓
Concurrency
```

그리고 전통적인 CPython에서는 그 Thread가 Python Bytecode를 실행하기 위해 GIL이라는 추가적인 조건을 만족해야 한다.

```text
OS Thread
   ↓
CPython
   ↓
GIL acquire
   ↓
Python Bytecode 실행
   ↓
GIL release
```

이렇게 보면 Thread와 GIL의 관계도 명확하다.

```text
Thread
→ 실행 흐름 자체에 대한 이야기

GIL
→ 그 Thread가 CPython에서
  Python Bytecode를 실행할 수 있는지에 대한 이야기
```

그리고 작업의 성격에 따라 GIL의 영향도 달라진다.

```text
                 Python Thread
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
         CPU-bound           I/O-bound
             │                   │
     Python 실행 지속        I/O 대기 발생
             │                   │
       GIL 영향 큼          GIL 해제 가능
             │                   │
             ↓                   ↓
   병렬 실행에 불리       Concurrency에 유용
```

마지막으로 free-threaded CPython은 이 오래된 제약 자체를 완화하는 방향으로 나아가고 있다.

```text
Traditional CPython

OS Thread
   ↓
GIL
   ↓
Python Bytecode
   ↓
Thread 기반 Concurrency


Free-threaded CPython

OS Threads
   ↓
여러 CPU Core
   ↓
Python 코드의 Parallelism
```

---
## 16. 마무리

처음 Python 코드를 작성했을 때 우리에게 보이는 것은 단순하다.

```python
def add(a, b):
    return a + b

print(add(1, 2))
```

하지만 그 아래에서는 훨씬 많은 일이 일어나고 있다.

```text
Source Code
    ↓
Token
    ↓
   AST
    ↓
Compiler
    ↓
Code Object
    ↓
Bytecode
    ↓
Interpreter
    ↓
Frame
    ↓
Function Call
    ↓
Iterator / Generator
    ↓
Coroutine
    ↓
Event Loop
    ↓
OS Thread
    ↓
   GIL
```

Source Code는 구조화되고 Bytecode로 변환되며, Interpreter는 Frame이라는 실행 상태를 가지고 Bytecode를 실행한다.

Generator와 Coroutine은 실행 상태를 유지한 채 중단되고 다시 시작될 수 있으며, Event Loop는 여러 Coroutine의 실행을 Scheduling한다.

Thread를 사용하면 하나의 Process 안에서 여러 OS Thread라는 실행 흐름을 만들 수 있고, 어떤 Thread를 CPU에서 실행할지는 OS가 결정한다.

그리고 전통적인 CPython에서는 여기서 한 단계가 더 존재한다.

**CPU에서 실행되고 있는 Thread라고 하더라도 Python Bytecode를 실행하려면 GIL을 획득해야 한다.**

```text
OS
↓
Thread Scheduling
↓
OS Thread
↓
CPython
↓
GIL
↓
Python Bytecode
```

따라서 **Thread Context Switching과 GIL의 소유권 전환은 같은 것이 아니다.**

하나는 OS가 관리하는 **실행 흐름의 전환**이고,

다른 하나는 CPython이 관리하는 **Python Bytecode 실행 권한의 전환**이다.

이 차이까지 이해하면 처음에는 서로 다른 개념처럼 보였던

```text
Bytecode
Frame
Generator
Coroutine
Event Loop
Thread
GIL
```

이 하나의 질문으로 연결된다.

> **내가 작성한 Python 코드는 실제로 어떻게 실행되는가?**

이 질문에 답할 수 있게 되는 것이 이번 **「파이썬 실행에 대한 이해」** 시리즈의 목적이다.

여기까지 왔다면 이제 Python 코드를 단순한 문법의 집합이 아니라, **Interpreter와 OS 위에서 움직이는 하나의 실행 모델**(Execution Model)로 바라볼 수 있다.