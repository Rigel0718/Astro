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

앞선 글에서는 Generator가 `yield`에서 실행을 중단하고, 이후 `next()`를 통해 다시 실행을 이어갈 수 있다는 것을 살펴봤다.

Coroutine도 이와 비슷하게 **실행을 끝내지 않은 채 중단되고 다시 이어질 수 있는 실행 흐름**을 가진다.

다만 Generator가 주로 값을 필요할 때 하나씩 생산하기 위한 구조라면, Coroutine은 주로 **어떤 작업을 기다리는 동안 자신의 실행을 중단할 수 있는 비동기 실행 흐름**을 만드는 데 사용된다.

이번 글에서는 다음 흐름을 중심으로 Coroutine 자체의 실행 구조를 살펴본다.

```text
Coroutine Function
       ↓ call
Coroutine Object
       ↓
     실행
       ↓
     await
       ↓
필요하다면 suspend
       ↓
     resume
```

Coroutine을 실제 비동기 작업으로 실행하고 여러 Coroutine의 실행을 관리하는 구조에는 `Task`와 `Event Loop`가 사용된다.

이 부분은 다음 글에서 자세히 살펴보고, 이번에는 먼저 **Coroutine이 어떻게 중단되고 다시 이어질 수 있는지**에 집중해보자.

---

## 1. Coroutine Function을 호출하면 Coroutine Object가 만들어진다

일반적인 함수는 호출하면 함수의 실행이 시작된다.

```python
def hello():
    print("hello")


hello()
```

반면 `async def`로 정의한 함수는 다르게 동작한다.

```python
async def hello():
    print("hello")
```

`hello()`를 호출해보자.

```python
coro = hello()

print(coro)
```

대략 다음과 같은 결과를 볼 수 있다.

```text
<coroutine object hello at ...>
```

이 시점에는 아직 `"hello"`가 출력되지 않는다.

`async def`로 정의된 함수는 **Coroutine Function**이고, 이를 호출하면 **Coroutine Object**가 만들어진다.

```text
async def hello()
       │
       │ define
       ▼
Coroutine Function
       │
       │ call
       ▼
Coroutine Object
```

이 구조는 앞에서 살펴본 Generator와 비슷하다.

```python
def gen():
    yield 1


g = gen()
```

Generator Function을 호출하면 Generator Object가 만들어졌다.

```text
Generator Function
       ↓ call
Generator Object
```

Coroutine도 마찬가지다.

```python
async def coro():
    ...


c = coro()
```

```text
Coroutine Function
       ↓ call
Coroutine Object
```

둘 모두 Function을 호출했을 때 **중단과 재개가 가능한 실행을 표현하는 객체**가 만들어진다는 공통점이 있다.

그리고 객체를 생성했다고 해서 본문이 바로 끝까지 실행되는 것도 아니다.

Generator의 경우 외부에서 `next()`를 호출하거나 `for`문이 반복을 진행시켰다.

```text
for / next()
      ↓
Generator Object
      ↓
     실행
```

Coroutine 역시 Coroutine Object의 실행을 진행시키는 외부의 실행 구조가 필요하다.

```text
비동기 실행 시스템
       ↓
Coroutine Object
       ↓
     실행
```

Python의 `asyncio`에서는 이 과정에 `Task`와 `Event Loop`가 사용된다.

따라서 Coroutine Object는 **실행 가능한 비동기 실행 흐름을 표현하지만, 객체가 만들어지는 것만으로 실행이 진행되는 것은 아니다.**

---

## 2. Coroutine Object는 실행 상태를 유지한다

Coroutine은 실행 도중 멈췄다가 나중에 다시 실행될 수 있다.

예를 들어 다음 Coroutine을 생각해보자.

```python
async def work():
    x = 10
    result = await something()
    print(x)
    return result
```

실행이 `await`에서 중단되었다고 해보자.

```text
x = 10
   ↓
await something()
   ↓
suspend
```

이때 `work()`의 실행은 끝난 것이 아니다.

나중에는 중단되었던 지점부터 다시 실행되어야 한다.

```text
resume
  ↓
result = ...
  ↓
print(x)
  ↓
return result
```

그러려면 실행이 중단되었을 때의 상태가 유지되어야 한다.

예를 들어 Python은 실행을 이어가기 위해 다음과 같은 상태를 보존해야 한다.

```text
local variables

현재 실행 위치

실행을 이어가기 위해 필요한 상태
```

앞에서 살펴본 Frame의 실행 상태와 연결해서 생각할 수 있다.

```text
Code Object
     ↓
실행 상태
     │
     ├── local variables
     ├── instruction position
     └── 그 밖의 실행에 필요한 상태
```

Coroutine은 이러한 실행 상태와 연결되어 있기 때문에 중간에 실행이 멈추더라도 처음부터 다시 실행할 필요가 없다.

```text
실행
 ↓
suspend
 ↓
실행 상태 유지
 ↓
resume
 ↓
이어서 실행
```

따라서 Coroutine의 중요한 특징은 **실행 상태를 유지하면서 중단되고 다시 이어질 수 있다는 것**이다.

---

## 3. `await`는 Coroutine이 실행을 양보할 수 있는 지점이다

Coroutine의 중단과 가장 밀접하게 연결되는 문법이 `await`다.

```python
async def fetch_data():
    data = await request()
    return data
```

`await`는 흔히 다음처럼 설명한다.

> `request()`가 끝날 때까지 기다린다.

틀린 설명은 아니지만 Coroutine의 실행 구조를 이해하려면 **어떻게 기다리는가**를 함께 봐야 한다.

`request()`의 결과를 아직 얻을 수 없다면 `fetch_data()`는 다음 코드로 진행할 수 없다.

```text
fetch_data
    ↓
request()
    ↓
결과를 기다려야 함
    ↓
현재 실행을 계속할 수 없음
```

일반적인 blocking 방식이라면 현재 실행 흐름이 결과가 준비될 때까지 붙잡혀 있을 수 있다.

Coroutine은 기다려야 하는 동안 자신의 실행 상태를 유지한 채 실행을 중단할 수 있다.

```text
Coroutine 실행
      ↓
await request()
      ↓
결과를 기다려야 함
      ↓
   suspend
```

이때 Coroutine은 `return`한 것도 아니고 실행이 완료된 것도 아니다.

나중에 실행이 재개되면 `await`의 결과를 받아 이후 코드를 계속 진행할 수 있다.

```text
resume
  ↓
await의 결과 획득
  ↓
data에 결과 저장
  ↓
return data
```

현재 Coroutine이 실행을 중단할 수 있기 때문에, 그동안 다른 비동기 작업을 진행할 수 있는 여지가 생긴다.

따라서 `await`는 **결과를 기다리는 과정에서 필요하다면 현재 Coroutine이 실행을 양보할 수 있는 지점**이라고 볼 수 있다.

---

## 4. `await`가 항상 Coroutine을 중단시키는 것은 아니다

`await`를 만났다고 해서 Coroutine이 항상 중단되는 것은 아니다.

중요한 것은 실제로 **기다려야 하는가**이다.

개념적으로 다음처럼 생각할 수 있다.

```text
await something
      │
      ▼
결과를 얻기 위해
기다려야 하는가?
      │
   ┌──┴──┐
   │     │
  no    yes
   │     │
   ▼     ▼
계속 실행  suspend
```

기다릴 필요가 없다면 현재 Coroutine은 그대로 계속 진행할 수 있다.

반대로 결과를 아직 얻을 수 없다면 실행을 중단하고 나중에 다시 이어갈 수 있다.

따라서

```text
await
 ↓
suspend
```

라고 항상 연결하기보다는

```text
await
 ↓
필요하다면
suspend
```

라고 이해하는 것이 더 정확하다.

`await`는 **Coroutine이 중단될 수 있는 지점**이지, 항상 실행을 중단시키는 명령은 아니다.

---

## 5. `await`의 대상은 Awaitable이다

`await` 뒤에는 아무 객체나 올 수 있는 것은 아니다.

다음 코드는 사용할 수 없다.

```python
async def main():
    result = await 10
```

정수 `10`은 `await`할 수 있는 객체가 아니기 때문이다.

Python에서는 `await`할 수 있는 객체를 **Awaitable**이라고 한다.

```text
Awaitable
    │
    └── await할 수 있는 객체
```

Coroutine Object도 Awaitable이다.

```python
async def fetch():
    return 10


async def main():
    result = await fetch()
```

`fetch()`를 호출하면 Coroutine Object가 만들어진다.

```text
fetch()
   ↓
Coroutine Object
```

그리고 이 객체는 `await`할 수 있다.

```text
fetch()
   ↓
Coroutine Object
   ↓
await 가능
```

따라서 다음 코드가 가능한 것이다.

```python
result = await fetch()
```

여기서 **Awaitable과 Coroutine은 같은 개념이 아니다.**

Awaitable은 `await`할 수 있다는 성질을 나타내고, Coroutine은 그 조건을 만족하는 객체 중 하나다.

Python의 비동기 실행에서는 이후 살펴볼 `Task`, `Future` 같은 객체도 Awaitable이다.

이 객체들이 왜 필요한지는 여러 Coroutine을 실제로 실행하고 관리하는 구조를 살펴보면서 다음 글에서 연결한다.

---

## 6. `return`은 실행을 종료하고 `await`는 실행을 중단할 수 있다

`return`과 `await`는 모두 실행 흐름에 영향을 주지만 역할은 다르다.

일반적인 함수에서 `return`을 실행하면 함수 실행이 종료된다.

```python
def func():
    x = 10
    return x
```

```text
execution
   ↓
return
   ↓
finished
```

`return` 이후에는 이 함수의 실행을 다시 이어갈 필요가 없다.

Coroutine의 `await`는 다르다.

```python
async def func():
    x = 10

    result = await something()

    print(x)
    return result
```

`await`에서 기다려야 한다면 Coroutine은 실행을 중단할 수 있다.

```text
execution
   ↓
 await
   ↓
suspend
```

하지만 실행은 아직 끝나지 않았다.

나중에 다시 실행될 수 있다.

```text
suspend
   ↓
resume
   ↓
print(x)
   ↓
return
   ↓
finished
```

두 동작을 비교하면 다음과 같다.

```text
return
  ↓
execution finished


await
  ↓
필요하다면 execution suspended
  ↓
resume
  ↓
execution continues
```

`return`은 **실행의 종료**이고, `await`에서 발생할 수 있는 suspend는 **실행의 일시적인 중단**이다.

---

## 7. 여러 Coroutine의 실행에는 별도의 관리가 필요하다

Coroutine 하나의 실행 구조는 지금까지 살펴본 내용으로 정리할 수 있다.

```text
Coroutine Object
       ↓
     실행
       ↓
     await
       ↓
필요하다면 suspend
       ↓
     resume
```

하지만 실제 비동기 프로그램에서는 여러 Coroutine이 함께 존재할 수 있다.

```text
Coroutine A

Coroutine B

Coroutine C
```

각 Coroutine은 서로 다른 실행 상태에 있을 수 있다.

```text
Coroutine A → 실행 가능

Coroutine B → 기다리는 중

Coroutine C → 완료
```

Coroutine 자체가 제공하는 것은 **중단되고 다시 이어질 수 있는 실행 흐름**이다.

여러 Coroutine이 존재하면 이보다 더 많은 관리가 필요하다.

```text
어떤 실행을 지금 진행할 것인가

어떤 실행이 기다리고 있는가

기다리던 작업이 언제 준비되었는가

완료된 실행의 결과는 무엇인가
```

Python의 `asyncio`에서는 Coroutine을 이러한 비동기 실행 시스템에서 관리하기 위해 **Task**를 사용한다.

그리고 여러 Task의 실행을 조율하는 중심에 **Event Loop**가 있다.

```text
Coroutine
   ↓
 Task
   ↓
Event Loop
```

실행 도중 아직 완료되지 않은 비동기 결과를 표현하기 위해서는 **Future** 같은 객체도 사용된다.

```text
Coroutine
   │
   ▼
 Task
   │
   ▼
Event Loop

Future
→ 아직 완료되지 않은 결과를 표현
```

즉 지금까지 살펴본 Coroutine은 비동기 실행 시스템의 출발점이다.

```text
Coroutine
────────────────────
중단되고 재개될 수 있는
비동기 실행 흐름


Task / Future / Event Loop
────────────────────
여러 Coroutine을 실제
비동기 작업으로 실행하고 관리
```

Coroutine 하나의 실행 모델이 여러 비동기 작업으로 확장되면서 `Task`, `Future`, `Event Loop`가 필요해진다.

이 구조는 다음 글에서 자세히 살펴본다.

---

# 정리

`async def`로 정의한 Coroutine Function을 호출하면 Coroutine Object가 만들어진다.

```text
Coroutine Function
       ↓ call
Coroutine Object
```

Coroutine Object는 **중단되고 다시 이어질 수 있는 비동기 실행 흐름**을 표현한다.

```text
Coroutine
   ↓
execution
   ↓
await
   ↓
필요하다면 suspend
   ↓
resume
   ↓
continue
```

이러한 중단과 재개가 가능한 이유는 Coroutine이 실행 상태와 연결되어 있기 때문이다.

```text
실행
 ↓
suspend
 ↓
실행 상태 유지
 ↓
resume
 ↓
이어서 실행
```

`await` 뒤에는 `await`할 수 있는 **Awaitable**이 오며, Coroutine Object도 Awaitable의 한 종류다.

또한 `await`는 무조건 실행을 중단시키는 명령이 아니다.

```text
await
  │
  ├── 기다릴 필요 없음 → 계속 실행
  │
  └── 기다려야 함      → suspend 가능
```

이 구조는 앞에서 살펴본 Generator와도 연결된다.

```text
Generator Function
       ↓
Generator Object
       ↓
for / next()
       ↓
실행


Coroutine Function
       ↓
Coroutine Object
       ↓
비동기 실행 시스템
       ↓
실행
```

Generator에서 `for`와 `next()`가 실행을 진행시켰던 것처럼, Coroutine도 실제 실행을 진행하고 관리하는 외부 구조가 필요하다.

Python의 `asyncio`에서는 Coroutine을 `Task`라는 관리 가능한 비동기 작업으로 다루고, `Event Loop`가 이러한 작업들의 실행을 조율한다.

다음 글에서는 **Coroutine → Task → Future → Event Loop**로 실행 구조를 확장하면서 여러 Coroutine이 실제로 어떻게 함께 실행되는지 살펴본다.

---
**다음 글 : 09. Event Loop는 Coroutine을 어떻게 실행하는가?**