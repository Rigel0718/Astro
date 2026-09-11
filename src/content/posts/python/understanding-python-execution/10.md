---
title: "10. Python에서 Thread는 어떻게 실행되는가"

description: "Python Thread와 OS Thread의 관계를 살펴보고, OS Scheduling과 Context Switching, Shared Memory를 통해 여러 Thread가 동시성을 만드는 과정을 이해합니다."

pubDatetime: 2026-09-10T10:52:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Thread
  - OS Thread
  - Context Switching
  - Concurrency

draft: false
---

앞선 글에서는 Coroutine과 Event Loop를 통해 하나의 Thread 안에서도 여러 작업을 번갈아 실행할 수 있다는 것을 살펴봤다.

Coroutine은 `await`에서 실행을 중단하고, Event Loop는 실행 가능한 Task를 다시 선택해서 이어서 실행한다.

그렇다면 이번에는 아예 **실행 흐름 자체를 여러 개 만드는 방식**을 생각해보자.

Python에서는 `threading.Thread`를 사용하면 하나의 Process 안에 여러 Thread를 만들 수 있다.

전체 흐름은 다음과 같이 볼 수 있다.

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

이번 글에서는 Python Thread가 실제로 무엇인지, 운영체제는 여러 Thread를 어떻게 실행하는지, 그리고 왜 여러 Thread가 하나의 메모리를 공유하는지 살펴본다.

---
## 1. Process란 무엇인가

먼저 Process는 **실행 중인 프로그램의 독립적인 실행 환경**이라고 볼 수 있다.

예를 들어 Python 프로그램을 하나 실행하면 운영체제는 그 프로그램을 위한 Process를 만든다.

```text
Python Program
      ↓
   Process
```

Process는 자신만의 메모리 공간과 실행 환경을 가진다.

개념적으로 보면 다음과 같다.

```text
Process
├── Code
├── Heap
├── Global Data
└── Threads
```

여기서 Thread는 **Process 안에서 실제 코드를 실행하는 흐름**이다.

즉,

> Process는 실행 환경이고, Thread는 그 안에서 움직이는 실행 흐름이다.

라고 볼 수 있다.

---
## 2. 하나의 Process에는 기본적으로 Thread가 존재한다

다음과 같은 간단한 Python 프로그램을 실행한다고 하자.

```python
print("hello")
```

우리는 별도로 Thread를 만들지 않았지만 프로그램은 이미 어떤 실행 흐름 위에서 동작하고 있다.

```text
Python Process
   ↓
Main Thread
   ↓
Python Code 실행
```

즉 Python 프로그램을 실행하면 기본적으로 **Main Thread**가 존재한다.

우리가 평소 작성하는 일반적인 Python 코드는 대부분 이 Main Thread 위에서 실행된다.

---
## 3. Python에서 Thread를 하나 더 만들면 어떻게 되는가?

Python에서는 `threading` 모듈을 이용해 새로운 Thread를 만들 수 있다.

```python
import threading

def work():
    print("working")

thread = threading.Thread(target=work)

thread.start()
thread.join()
```

여기서 중요한 것은 `Thread` 객체를 만드는 것만으로 바로 새로운 실행이 시작되는 것은 아니라는 점이다.

```python
thread = threading.Thread(target=work)
```

이 단계에서는 실행할 작업에 대한 Python 객체를 만든 것이다.

실제 Thread 실행은 다음 호출에서 시작된다.

```python
thread.start()
```

개념적으로 보면:

```text
threading.Thread(...)
        ↓
Python Thread Object
        ↓
     start()
        ↓
OS Thread 생성 / 시작
        ↓
target 함수 실행
```

즉 Python의 `threading.Thread`는 단순히 Python 내부에서만 존재하는 가상의 실행 흐름이 아니다.

CPython에서는 일반적으로 운영체제가 제공하는 **실제 OS Thread**와 연결되어 실행된다.

---
## 4. Python Thread와 OS Thread는 어떤 관계인가?

개념적으로는 다음과 같이 생각할 수 있다.

```text
Python
│
└── threading.Thread
        ↓
     CPython
        ↓
     OS Thread
```

예를 들어:

```python
t1 = threading.Thread(target=work)
t2 = threading.Thread(target=work)
```

두 Thread를 시작하면 Process 안에 여러 실행 흐름이 존재하게 된다.

```text
Python Process
│
├── Main Thread
├── Thread A
└── Thread B
```

운영체제 입장에서는 각각 실제 스케줄링 가능한 Thread다.

즉 운영체제는 이 Thread들을 CPU에서 실행할 수 있다.

---
## 5. 그렇다면 어떤 Thread가 먼저 실행되는가?

이제부터는 Python보다 **운영체제의 역할**이 중요해진다.

여러 Thread가 동시에 실행 가능한 상태라고 하자.

```text
Thread A
Thread B
Thread C
```

이 중 어떤 Thread를 CPU에서 실행할지는 일반적으로 OS Scheduler가 결정한다.

```text
Runnable Threads
      ↓
OS Scheduler
      ↓
     CPU
```

예를 들어 한 순간에는 Thread A가 실행될 수 있다.

```text
CPU
 ↓
Thread A
```

잠시 뒤 운영체제가 Thread B를 실행할 수도 있다.

```text
CPU
 ↓
Thread B
```

즉 Thread 실행 순서를 Python 코드가 직접 완전히 통제하는 것이 아니다.

---
## 6. Scheduling이란 무엇인가?

Scheduling은 **실행 가능한 여러 Thread 중 어떤 Thread에게 CPU 시간을 줄지 결정하는 것**이다.

개념적으로:

```text
Thread A ──┐
Thread B ──┼──→ OS Scheduler ──→ CPU
Thread C ──┘
```

운영체제는 다양한 요소를 고려해 Thread 실행 순서를 조정한다.

예를 들면:

```text
실행 가능 여부
우선순위
CPU 사용 상태
I/O 대기 여부
운영체제의 Scheduling 정책
```

등이 영향을 줄 수 있다.

Python 코드 입장에서는 단순히:

```python
t1.start()
t2.start()
```

라고 작성했더라도,

```text
t1이 항상 먼저 끝난다
```

고 보장할 수는 없다.

실제 실행 순서는 OS Scheduling에 따라 달라질 수 있다.

---
## 7. Context Switching은 무엇인가?

하나의 CPU Core가 있다고 생각해보자.

현재 Thread A가 실행 중이다.

```text
CPU Core
   ↓
Thread A
```

그런데 OS Scheduler가 이제 Thread B를 실행하기로 결정했다면, CPU는 A를 멈추고 B를 실행해야 한다.

이때 필요한 것이 **Context Switching**이다.

```text
Thread A 실행
      ↓
상태 저장
      ↓
Context Switch
      ↓
Thread B 상태 복원
      ↓
Thread B 실행
```

여기서 Context란 Thread가 다시 실행될 때 필요한 CPU 실행 상태를 의미한다.

개념적으로는 다음과 같은 정보들이 포함된다.

```text
CPU Registers
Stack Pointer
Program Counter
기타 실행 상태
```

운영체제는 Thread A의 상태를 저장한 뒤 Thread B의 상태를 복원한다.

그래야 나중에 A가 다시 선택되었을 때 중단했던 지점부터 이어서 실행할 수 있다.

---
## 8. Thread가 멈췄다가 다시 실행될 수 있는 이유

예를 들어 다음처럼 실행된다고 하자.

```text
Thread A
   ↓
작업 수행
   ↓
OS에 의해 중단
```

잠시 뒤:

```text
Thread A
   ↓
이전 상태 복원
   ↓
중단 지점부터 다시 실행
```

이것이 가능한 이유는 운영체제가 각 Thread의 실행 상태를 관리하기 때문이다.

즉 Thread는 단순히 함수 하나를 의미하는 것이 아니다.

Thread에는 **독립적인 실행 상태**가 존재한다.

```text
Thread
├── Stack
├── CPU Context
├── Scheduling State
└── Execution Flow
```

그래서 여러 Thread는 서로 다른 함수 위치에서 각각 실행을 이어갈 수 있다.

---
## 9. 여러 CPU Core가 있다면 어떻게 되는가?

CPU Core가 하나라면 여러 Thread는 기본적으로 번갈아 CPU를 사용한다.

```text
Single Core

time ─────────────────────→

Thread A  ████        ████
Thread B      ████
Thread C          ████
```

한 순간에는 하나의 Thread만 해당 Core에서 실행되지만 매우 빠르게 전환되면서 여러 작업이 동시에 진행되는 것처럼 보일 수 있다.

이것이 **Concurrency**, 즉 동시성이다.

반면 여러 CPU Core가 있다면 운영체제는 여러 Thread를 서로 다른 Core에 배치할 수도 있다.

```text
Core 1 → Thread A
Core 2 → Thread B
Core 3 → Thread C
```

이 경우 물리적으로 같은 순간에 여러 Thread가 실행될 수도 있다.

이것이 **Parallelism**, 즉 병렬성이다.

다만 Python에서는 여기서 한 가지 추가적인 이야기가 필요하다.

전통적인 CPython에는 GIL이라는 제약이 있기 때문이다.

하지만 그 내용은 다음 글에서 다룬다.

이번 글에서 중요한 것은:

> **OS Thread 자체는 여러 CPU Core에서 병렬로 실행될 수 있는 실행 단위다.**

라는 점이다.

---
## 10. Thread들은 무엇을 공유하는가?

Thread는 서로 독립적인 실행 흐름이지만 같은 Process 안에 존재한다.

따라서 Process의 메모리 공간을 공유한다.

개념적으로 보면:

```text
Process
│
├── Heap
├── Global Data
│
├── Thread A
├── Thread B
└── Thread C
```

Thread A와 Thread B는 같은 객체에 접근할 수 있다.

예를 들어:

```python
import threading

numbers = []

def work():
    numbers.append(1)
```

`numbers`는 같은 Process의 메모리 안에 존재한다.

```text
Thread A ──┐
           ├──→ numbers
Thread B ──┘
```

두 Thread 모두 같은 `numbers` 객체를 볼 수 있다.

이것이 Thread의 큰 특징 중 하나다.

---
## 11. Thread마다 독립적으로 가지는 것은 무엇인가?

메모리를 모두 공유하는 것은 아니다.

각 Thread는 자신의 실행 흐름을 유지해야 하므로 자신만의 Stack과 실행 상태를 가진다.

```text
Process
│
├── Shared Heap
│
├── Thread A
│   └── Stack A
│
└── Thread B
    └── Stack B
```

예를 들어 두 Thread가 같은 함수를 실행하더라도 지역 변수는 각자의 호출 Stack 안에서 관리된다.

```python
def work():
    x = 10
```

Thread A가 실행한 `x`와 Thread B가 실행한 `x`는 각각 독립적인 함수 실행 상태에 속한다.

```text
Thread A Stack
└── work()
    └── x = 10

Thread B Stack
└── work()
    └── x = 10
```

하지만 두 Thread가 Heap에 있는 동일한 객체를 참조할 수도 있다.

```text
Thread A Stack ──┐
                 ├──→ Shared Object
Thread B Stack ──┘
```

즉:

```text
Stack
→ Thread마다 독립적

Heap / Process Memory
→ Thread 간 공유
```

라고 이해할 수 있다.

---
## 12. Shared Memory는 왜 중요한가?

Thread끼리 메모리를 공유한다는 것은 매우 편리하다.

Process끼리는 기본적으로 독립된 메모리 공간을 사용하기 때문에 데이터를 주고받으려면 별도의 통신 방식이 필요하다.

```text
Process A Memory

Process B Memory
```

반면 같은 Process의 Thread는:

```text
Thread A ──┐
           ├──→ Shared Memory
Thread B ──┘
```

처럼 같은 객체에 바로 접근할 수 있다.

이 때문에 Thread는 데이터를 공유하면서 여러 작업을 수행하기에 편리하다.

하지만 동시에 문제가 생길 수도 있다.

---
## 13. Shared Memory에는 Race Condition이 생길 수 있다

예를 들어 여러 Thread가 같은 값을 수정한다고 하자.

```python
counter = 0
```

두 Thread가 동시에 다음 작업을 수행한다.

```python
counter += 1
```

우리는 겉으로 보면 단순히:

```text
counter
   ↓
   +1
```

처럼 생각하기 쉽다.

하지만 내부적으로는 대략:

```text
값 읽기
  ↓
1 증가
  ↓
값 저장
```

과 같은 여러 단계로 나뉠 수 있다.

두 Thread가 실행되면:

```text
Thread A: counter 읽기 → 0

Thread B: counter 읽기 → 0

Thread A: 1 저장

Thread B: 1 저장
```

처럼 실행될 가능성이 있다.

우리가 기대한 결과는:

```text
2
```

였지만 실제 결과가:

```text
1
```

이 될 수 있다.

이처럼 실행 순서에 따라 결과가 달라지는 문제를 **Race Condition**이라고 한다.

---
## 14. 그래서 Lock이 필요하다

여러 Thread가 공유 데이터를 안전하게 수정해야 한다면 동기화가 필요하다.

Python에서는 `threading.Lock`을 사용할 수 있다.

```python
import threading

lock = threading.Lock()

counter = 0

def work():
    global counter

    with lock:
        counter += 1
```

Lock을 사용하면 한 Thread가 중요한 영역을 실행하는 동안 다른 Thread의 접근을 제한할 수 있다.

```text
Thread A
   ↓
Lock 획득
   ↓
Shared Data 수정
   ↓
Lock 해제

Thread B
   ↓
그동안 대기
```

이렇게 공유 데이터에 대한 동시 접근을 조절하는 것을 **Synchronization**이라고 한다.

여기서 사용하는 `threading.Lock`과 다음 글에서 다룰 GIL은 같은 개념이 아니다.

```text
threading.Lock
→ 우리가 공유 데이터를 보호하기 위해 사용하는 Lock

GIL
→ CPython Interpreter 내부 실행과 관련된 Lock
```

이 둘은 반드시 구분해야 한다.

---
## 15. Thread의 Concurrency는 어떻게 만들어지는가?

여러 Thread가 있을 때 운영체제는 실행 가능한 Thread들을 Scheduling한다.

```text
Thread A
Thread B
Thread C
    ↓
OS Scheduler
```

한 Core에서는 빠르게 번갈아 실행될 수 있다.

```text
time ───────────────────────────→

Thread A  ███      ███
Thread B     ███
Thread C        ███     ███
```

각 Thread는 중간에:

```text
CPU 실행
I/O 대기
Sleep
Lock 대기
```

같은 상태를 가질 수 있다.

예를 들어 Thread A가 네트워크 응답을 기다리고 있다면:

```text
Thread A → I/O Waiting
```

운영체제는 CPU를 그냥 놀리지 않고 다른 실행 가능한 Thread를 실행할 수 있다.

```text
Thread A → waiting

Thread B → running
```

이처럼 여러 작업의 진행 시간이 겹치도록 만드는 것이 Thread 기반 **Concurrency**의 핵심이다.

---
## 16. Thread와 Coroutine의 가장 큰 차이

앞선 글의 Coroutine과 비교해보자.

Coroutine은 하나의 Thread 안에서 여러 실행 상태를 관리할 수 있다.

```text
Single Thread
    ↓
Event Loop
├── Coroutine A
├── Coroutine B
└── Coroutine C
```

Coroutine A가 `await`을 만나면 직접 실행을 중단한다.

```text
Coroutine A
   ↓
 await
   ↓
Event Loop
   ↓
Coroutine B
```

반면 Thread에서는 운영체제가 여러 Thread를 Scheduling한다.

```text
Thread A
Thread B
Thread C
    ↓
OS Scheduler
```

즉 실행을 관리하는 주체가 다르다.

```text
Coroutine
→ Event Loop가 Scheduling

Thread
→ OS가 Scheduling
```

또한 Coroutine끼리는 보통 같은 OS Thread 안에서 실행되지만 Thread는 각각 독립적인 OS 실행 단위다.

```text
Coroutine

OS Thread
├── Coroutine A
├── Coroutine B
└── Coroutine C
```

반면:

```text
Thread

Process
├── OS Thread A
├── OS Thread B
└── OS Thread C
```

이 차이가 매우 중요하다.

---
## 17. Coroutine의 전환과 Thread의 Context Switching도 다르다

Coroutine A에서 Coroutine B로 넘어가는 것은 Event Loop 수준의 실행 전환이다.

```text
Coroutine A
   ↓
 await
   ↓
Coroutine B
```

이때 반드시 OS Thread 자체가 바뀌는 것은 아니다.

하나의 동일한 Thread에서:

```text
Same OS Thread

Coroutine A
   ↓
Coroutine B
```

처럼 실행될 수 있다.

반면 Thread Context Switching은 OS가 실행 중인 Thread 자체를 변경하는 것이다.

```text
OS Thread A
   ↓
Context Switch
   ↓
OS Thread B
```

따라서:

```text
Coroutine Switching
        ≠
Thread Context Switching
```

이다.

Coroutine의 전환은 사용자 공간의 Event Loop 수준에서 일어날 수 있지만, Thread Context Switching은 OS Scheduler가 관여하는 운영체제 수준의 작업이다.

---
## 18. Thread의 장점과 비용

Thread의 가장 큰 장점 중 하나는 공유 메모리다.

```text
Thread A ──┐
           ├──→ Shared Objects
Thread B ──┘
```

Process 사이의 데이터 전달보다 비교적 간단하게 같은 데이터를 공유할 수 있다.

또한 I/O 대기가 많은 작업에서는 여러 Thread가 서로의 대기 시간을 활용할 수 있다.

하지만 비용도 존재한다.

```text
Thread 생성 비용
Context Switching 비용
Stack 메모리
Synchronization 필요
Race Condition
Deadlock 가능성
```

따라서 Thread를 많이 만든다고 항상 성능이 좋아지는 것은 아니다.

Concurrency를 어떤 방식으로 구성할지는 작업의 특성에 따라 달라진다.

---
## 19. 전체 실행 흐름을 다시 정리해보자

Python에서 Thread를 만들면 개념적으로 다음 흐름이 만들어진다.

```text
Python Process
      ↓
threading.Thread
      ↓
   start()
      ↓
OS Thread
      ↓
OS Scheduler
      ↓
CPU에서 실행
      ↓
Context Switching
      ↓
여러 Thread의 진행
```

각 Thread는 자신의 Stack과 실행 상태를 가진다.

```text
Thread A
└── Stack A

Thread B
└── Stack B
```

하지만 같은 Process 안의 Heap과 객체는 공유한다.

```text
Thread A ──┐
           ├──→ Shared Heap
Thread B ──┘
```

그래서:

```text
독립적인 실행 흐름
        +
공유되는 메모리
        ↓
Thread 기반 Concurrency
```

가 만들어진다.

---
## 20. 그런데 Python에는 한 가지 이야기가 더 남아 있다

여기까지 보면 이런 결론을 내릴 수 있다.

```text
OS Thread는 여러 개 만들 수 있다.

OS Scheduler는 여러 Thread를 실행할 수 있다.

CPU Core가 여러 개라면
여러 Thread를 병렬로 실행할 수도 있다.
```

운영체제 수준에서는 맞는 이야기다.

하지만 **전통적인 CPython에서 Python Bytecode를 실행하는 것**에는 한 가지 추가적인 제약이 존재한다.

바로 **GIL(Global Interpreter Lock)**이다.

즉 지금까지 살펴본 것은:

```text
OS는 Thread를 어떻게 실행하는가?
```

에 대한 이야기였다.

다음 글에서는 여기서 한 단계 더 들어가:

```text
그 OS Thread가 CPython에서
Python Bytecode를 실행하려면
어떤 제약을 받는가?
```

를 살펴본다.

그 중심에 GIL이 있다.

---

## 21. 마무리

Python에서 Thread를 이해할 때 가장 먼저 기억해야 할 것은 `threading.Thread`가 단순한 Python 문법이 아니라는 점이다.

그 아래에는 실제 OS Thread가 존재한다.

```text
Python
   ↓
threading.Thread
   ↓
OS Thread
```

운영체제는 Scheduler를 통해 여러 Thread의 실행을 관리하고, 필요하면 Context Switching을 수행한다.

```text
OS Scheduler
    ↓
Thread A
    ↓
Context Switch
    ↓
Thread B
```

각 Thread는 자신의 Stack과 실행 상태를 가지지만 같은 Process의 메모리 공간을 공유한다.

```text
Process
│
├── Shared Heap
│
├── Thread A
│   └── Stack A
│
└── Thread B
    └── Stack B
```

이 구조 덕분에 여러 Thread가 하나의 Process 안에서 서로 다른 작업을 동시에 진행할 수 있다.

```text
Process
   ↓
OS Threads
   ↓
Scheduling
   ↓
Context Switching
   ↓
Shared Memory
   ↓
Concurrency
```

그리고 여기까지가 **Thread 자체의 실행 모델**이다.

다음 글에서 다룰 GIL은 Thread 자체를 만드는 기술도 아니고 OS Context Switching을 수행하는 기술도 아니다.

GIL은 그 위에서:

> **전통적인 CPython에서 어떤 Thread가 Python Bytecode를 실행할 수 있는가**

를 제한하는 별도의 메커니즘이다.

이 경계를 분명히 해두면 다음 글에서 GIL을 훨씬 정확하게 이해할 수 있다.

---
**다음 글 : 11 GIL은 Python의 Thread 실행에 어떤 영향을 주는가**