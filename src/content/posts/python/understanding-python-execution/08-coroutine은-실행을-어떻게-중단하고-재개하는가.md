---
title: "08. Coroutine은 실행을 어떻게 중단하고 재개하는가"

description: "Python Coroutine이 async def로 생성되고 await에서 실행을 중단한 뒤, Awaitable의 완료에 따라 다시 실행을 이어가는 suspend와 resume의 동작 원리를 이해합니다."

pubDatetime: 2026-09-08T15:55:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Coroutine
  - async
  - await
  - Awaitable

draft: false
---

앞선 글에서는 Generator가 `yield`를 만나면 실행을 멈추고, 이후 다시 그 지점부터 실행을 이어갈 수 있다는 것을 살펴봤다.

```python
def gen():
    print("A")
    yield
    print("B")
```

Generator의 중요한 특징은 **함수 실행이 끝나지 않았는데도 중간에 멈출 수 있다는 것**이다.

Coroutine도 이와 비슷하다.

다만 Coroutine은 단순히 값을 하나씩 만들어내기 위한 것이 아니라, **어떤 작업이 끝나기를 기다리는 동안 자신의 실행을 중단하고 다른 작업이 실행될 수 있도록 하기 위해 사용된다.**

이번에는 다음 흐름을 따라가 보자.

```text
async def
   ↓
Coroutine Function
   ↓ 호출
Coroutine Object
   ↓
 await
   ↓
suspend
   ↓
Awaitable 완료
   ↓
resume
```

---

## 1. `async def`를 호출하면 함수가 바로 실행될까?

일반적인 함수부터 생각해보자.

```python
def hello():
    print("hello")

hello()
```

`hello()`를 호출하면 Python은 새로운 Frame을 만들고 함수의 코드를 실행한다.

하지만 `async def`로 정의한 함수는 조금 다르다.

```python
async def hello():
    print("hello")
```

이 함수에 `async`가 붙었다고 해서 정의되는 순간 특별한 일이 발생하는 것은 아니다.

중요한 차이는 **호출할 때** 나타난다.

```python
coro = hello()

print(coro)
```

대략 다음과 같은 결과를 볼 수 있다.

```text
<coroutine object hello at ...>
```

그리고 아직 `"hello"`는 출력되지 않았다.

즉,

```python
hello()
```

는 `hello` 함수의 본문을 즉시 실행하는 것이 아니라 **Coroutine Object를 생성한다.**

```text
async def hello():
        │
        └── Coroutine Function

hello()
   │
   └── Coroutine Object
```

이 점은 앞에서 살펴본 Generator와 상당히 비슷하다.

```python
def gen():
    yield 1

g = gen()
```

Generator Function을 호출하면 Generator Object가 만들어지듯,

```python
async def coro():
    ...

c = coro()
```

Coroutine Function을 호출하면 Coroutine Object가 만들어진다.

---

## 2. 그렇다면 Coroutine Object는 무엇을 가지고 있을까?

Coroutine은 실행 도중 멈췄다가 다시 실행될 수 있어야 한다.

그러려면 단순히 실행할 코드만 알고 있어서는 안 된다.

예를 들어 다음 Coroutine을 생각해보자.

```python
async def work():
    x = 10
    await something()
    print(x)
```

`await`에서 실행이 중단되었다고 해보자.

나중에 다시 실행할 때 Python은 최소한 다음과 같은 사실을 알고 있어야 한다.

```text
x = 10이었다

어디까지 실행했는가?

어떤 await를 기다리고 있었는가?

다음에는 어디서부터 실행해야 하는가?
```

즉 Coroutine은 자신의 **실행 상태**(execution state)를 보존할 수 있어야 한다.

이 구조는 앞에서 살펴본 Frame과 Generator의 이야기와 연결된다.

```text
Code Object
     ↓
   Frame
     ↓
   locals
 operand stack
instruction position
     ↓
execution state
```

Coroutine 역시 실행 상태를 유지하기 때문에 `await`에서 멈춘 뒤 나중에 그 지점부터 실행을 이어갈 수 있다.

결국 Coroutine의 핵심도 다음 두 단어로 압축할 수 있다.

```text
suspend
   ↓
resume
```

---

## 3. `await`는 무엇을 하는가?

Coroutine의 핵심 문법은 `await`다.

예를 들어 다음 코드가 있다고 해보자.

```python
async def fetch_data():
    data = await request()
    return data
```

처음 보면 `await`를 단순히 다음처럼 생각하기 쉽다.

> request가 끝날 때까지 여기서 기다린다.

틀린 설명은 아니지만, Coroutine을 이해하기에는 조금 부족하다.

더 중요한 것은 **어떻게 기다리는가**이다.

일반적인 동기 코드라면 작업이 끝날 때까지 현재 실행 흐름을 붙잡고 있을 수 있다.

하지만 `await`의 중요한 역할은 기다려야 하는 상황에서 **현재 Coroutine의 실행을 중단(suspend)할 수 있게 하는 것**이다.

개념적으로는 다음과 같다.

```text
fetch_data 실행

data = await request()
             │
             ├── 아직 완료되지 않음
             │
             ▼
       fetch_data suspend
```

이때 `fetch_data()`가 끝난 것은 아니다.

`return`한 것도 아니다.

단지 **실행 중간에 멈춰 있는 상태**다.

그리고 기다리던 작업이 완료되면 다시 실행될 수 있다.

```text
request 완료
     ↓
fetch_data resume
     ↓
data에 결과 저장
     ↓
return data
```

따라서 `await`의 핵심은 단순한 "대기"보다 다음에 가깝다.

> **지금 결과를 얻을 수 없다면 현재 Coroutine의 실행을 중단하고, 결과를 얻을 수 있게 되었을 때 다시 실행을 이어갈 수 있도록 한다.**

---

## 4. suspend는 프로그램 전체를 멈추는 것이 아니다

여기서 매우 중요한 차이가 하나 있다.

Coroutine이 suspend된다고 해서 **Python 프로그램 전체가 suspend되는 것은 아니다.**

예를 들어 두 Coroutine이 있다고 해보자.

```python
async def task_a():
    print("A start")
    await something()
    print("A end")

async def task_b():
    print("B")
```

`task_a`가 `await`에서 기다려야 한다면 개념적으로 다음과 같은 일이 가능하다.

```text
task_a
│
├─ "A start"
│
├─ await something()
│
└─ suspend
       ↓
   task_b 실행
       │
       └─ "B"
       ↓
something 완료
       ↓
task_a resume
│
└─ "A end"
```

즉 Coroutine은

> **내가 지금 할 일이 없으니 다른 실행 흐름이 진행될 수 있도록 실행권을 넘길 수 있는 구조**

를 제공한다.

이것이 일반적인 함수 호출과 Coroutine 실행의 큰 차이다.

---

## 5. `await` 뒤에는 아무거나 올 수 있을까?

그렇지는 않다.

다음과 같은 코드는 사용할 수 없다.

```python
async def main():
    x = await 10
```

`10`은 기다릴 수 있는 대상이 아니기 때문이다.

`await` 뒤에는 **Awaitable** 객체가 와야 한다.

Python에서 Awaitable은 말 그대로

> **await할 수 있는 객체**

를 의미한다.

대표적으로 다음과 같은 것들이 있다.

```text
Awaitable
├── Coroutine
├── Task
└── Future
```

예를 들어 Coroutine 자체도 Awaitable이다.

```python
async def foo():
    return 10

async def main():
    result = await foo()
```

여기서

```python
foo()
```

는 Coroutine Object를 반환하고,

```python
await foo()
```

는 그 Coroutine의 완료를 기다린다.

따라서 관계를 단순화하면 다음과 같다.

```text
foo()
 ↓
Coroutine Object
 ↓
Awaitable
 ↓
await 가능
```

다만 **Awaitable = Coroutine**은 아니다.

Coroutine은 Awaitable의 한 종류일 뿐이다.

이 구분은 이후 `Task`, `Future`, `Event Loop`를 이해할 때 중요해진다.

---

## 6. `await`는 `return`과 무엇이 다른가?

`return`과 `await`는 실행 흐름을 다룬다는 점에서는 비슷해 보이지만 의미는 완전히 다르다.

`return`은 함수의 실행을 **종료**한다.

```python
def func():
    x = 10
    return x
```

`return` 이후 이 함수의 실행 상태를 다시 이어갈 필요가 없다.

반면 `await`는 Coroutine의 실행을 **중단할 수 있다.**

```python
async def func():
    x = 10

    result = await something()

    print(x)
    return result
```

`await`에서 Coroutine이 suspend되더라도 `func`는 끝난 것이 아니다.

나중에 resume되어 다음 코드를 계속 실행해야 한다.

```text
return
  ↓
execution finished


await
  ↓
execution suspended
  ↓
resume
  ↓
execution continues
```

이 차이가 Coroutine을 이해하는 핵심이다.

---

## 7. Generator의 `yield`와 Coroutine의 `await`는 왜 비슷해 보일까?

앞선 Generator를 다시 생각해보자.

```python
def gen():
    print("A")
    yield 1
    print("B")
```

Generator는 `yield`에서 실행을 멈춘다.

```text
Generator

execution
   ↓
yield
   ↓
suspend
   ↓
next()
   ↓
resume
```

Coroutine도 구조적으로 비슷한 모습을 가진다.

```text
Coroutine

execution
   ↓
 await
   ↓
suspend
   ↓
기다리던 작업 완료
   ↓
resume
```

둘 모두 핵심은

```text
실행
 ↓
중단
 ↓
실행 상태 보존
 ↓
재개
```

이다.

하지만 목적에는 차이가 있다.

Generator는 주로 **값을 필요할 때 하나씩 생산하는 실행 흐름**을 만드는 데 사용된다.

Coroutine은 주로 **기다리는 동안 실행을 양보할 수 있는 비동기 실행 흐름**을 만드는 데 사용된다.

그래서 앞선 Generator를 이해했다면 Coroutine은 완전히 새로운 개념이라기보다,

> **중단하고 재개할 수 있는 실행 모델이 비동기 프로그래밍으로 확장된 것**

으로 바라보는 것이 좋다.

---

## 8. 그런데 누가 Coroutine을 다시 실행시켜주는가?

여기까지 오면 중요한 의문이 하나 남는다.

```python
async def main():
    data = await fetch_data()
```

`fetch_data()`가 기다려야 해서 suspend되었다고 해보자.

그렇다면 누가 다음을 판단할까?

```text
fetch_data는 지금 기다려야 한다.

그동안 다른 Coroutine을 실행하자.

fetch_data가 기다리던 작업이 끝났다.

이제 fetch_data를 다시 실행하자.
```

Coroutine 자체가 이 모든 것을 관리하는 것은 아니다.

Coroutine은 기본적으로 **중단되고 재개될 수 있는 실행 단위**다.

그렇다면 여러 Coroutine을 관리하면서

```text
누구를 실행할지

누구를 기다리게 할지

누구를 다시 깨울지
```

결정하는 무언가가 필요하다.

Python의 `asyncio`에서는 이 역할의 중심에 **Event Loop**가 있다.

그리고 Coroutine을 Event Loop가 관리할 수 있는 실행 단위로 감싸는 **Task**, 아직 완료되지 않은 비동기 결과를 표현하는 **Future** 같은 개념이 등장한다.

전체 구조는 점차 다음과 같이 확장된다.

```text
async def
   ↓
Coroutine Object
   ↓
 Task
   ↓
Event Loop
   ↓
  실행
   ↓
 await
   ↓
suspend
   ↓
다른 Task 실행
   ↓
Awaitable 완료
   ↓
resume
```

이제 `async` / `await` 문법만 알고 있는 것에서 한 단계 더 나아가,

**Python이 어떻게 여러 Coroutine의 실행을 조율하는가**

라는 질문으로 넘어갈 수 있다.

---

# 정리

`async def`로 정의된 함수를 호출하면 일반 함수처럼 본문이 즉시 끝까지 실행되는 것이 아니라 **Coroutine Object**가 만들어진다.

```text
async def
   ↓
Coroutine Function
   ↓ 호출
Coroutine Object
```

Coroutine은 실행 도중 `await`를 만났을 때 기다리는 작업이 완료되지 않았다면 자신의 실행 상태를 보존한 채 **suspend**될 수 있다.

```text
Coroutine
   ↓
execution
   ↓
await Awaitable
   ↓
suspend
```

그리고 기다리던 작업이 완료되면 이전 실행 상태를 이용해 다시 실행을 이어간다.

```text
Awaitable 완료
   ↓
resume
   ↓
continue execution
```

따라서 Coroutine의 본질은 단순히 "`async`를 붙인 함수"가 아니다.

> **실행 상태를 유지한 채 중단되고 다시 재개될 수 있는 비동기 실행 흐름이다.**

그리고 이 구조는 앞에서 살펴본 Generator와 연결된다.

```text
Generator
yield → suspend → next() → resume

Coroutine
await → suspend → Awaitable 완료 → resume
```

하지만 여기에는 아직 한 가지 중요한 부분이 빠져 있다.

Coroutine은 **중단될 수 있는 방법**을 제공하지만, 여러 Coroutine 중 무엇을 언제 실행하고 다시 깨울 것인지는 스스로 결정하지 않는다.

그렇다면 Python은 수많은 Coroutine을 어떻게 관리하고 실행 순서를 조율할까?

다음 글에서는 이 실행 흐름의 중심에 있는 **Event Loop**를 살펴보자.

---
**다음 글 : 09. Event Loop는 여러 Coroutine을 어떻게 실행하는가?**
