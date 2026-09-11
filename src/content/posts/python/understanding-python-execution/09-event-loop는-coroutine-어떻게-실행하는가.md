---
title: "09. Event Loop는 Coroutine을 어떻게 실행하는가"

description: "Python asyncio에서 Coroutine이 Task로 스케줄링되고, Event Loop가 여러 비동기 작업을 조율하는 과정을 이해합니다."

pubDatetime: 2026-09-09T15:54:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Event Loop
  - Task
  - Future
  - asyncio

draft: false
---

앞선 글에서는 Coroutine 자체의 실행 구조를 살펴봤다.

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

Coroutine은 실행 상태를 유지하면서 중단되고 다시 이어질 수 있다.

하지만 실제 비동기 프로그램에서는 하나가 아니라 여러 Coroutine이 함께 실행된다.

```text
Coroutine A

Coroutine B

Coroutine C
```

어떤 Coroutine은 실행할 수 있고, 어떤 Coroutine은 I/O를 기다리고 있으며, 어떤 Coroutine은 이미 완료되었을 수 있다.

따라서 여러 Coroutine을 실제로 실행하려면 **각 실행을 하나의 작업으로 관리하고, 실행 가능한 작업을 적절한 시점에 진행시키는 시스템**이 필요하다.

Python의 `asyncio`에서는 이 구조의 중심에 `Task`와 `Event Loop`가 있다.

```text
Coroutine
   ↓
 Task
   ↓
Event Loop
   ↓
scheduling
```

그리고 실행 도중 아직 완료되지 않은 결과와 완료 상태를 표현하기 위해 `Future` 같은 객체가 사용된다.

이번 글에서는 각각의 객체를 따로 외우기보다, **Coroutine 하나의 실행이 어떻게 여러 비동기 작업을 관리하는 실행 시스템으로 확장되는지**를 따라가 보자.

---

## 1. 여러 Coroutine은 각각의 작업 상태를 가진다

다음과 같은 Coroutine들이 있다고 해보자.

```python
async def fetch_user():
    ...


async def fetch_posts():
    ...


async def fetch_comments():
    ...
```

각 함수를 호출하면 Coroutine Object가 만들어진다.

```python
coro_a = fetch_user()
coro_b = fetch_posts()
coro_c = fetch_comments()
```

```text
Coroutine A

Coroutine B

Coroutine C
```

하지만 세 Coroutine이 항상 같은 상태에 있는 것은 아니다.

실행이 시작되면 개념적으로 다음처럼 서로 다른 상태에 놓일 수 있다.

```text
Coroutine A → 실행 가능

Coroutine B → I/O를 기다리는 중

Coroutine C → 완료
```

비동기 실행 시스템은 이러한 실행들을 구분해서 관리해야 한다.

실행 가능한 작업은 진행할 수 있지만, I/O를 기다리는 작업은 기다리던 작업이 준비되기 전까지 더 진행할 수 없다.

```text
실행 가능
   ↓
진행 가능


기다리는 중
   ↓
지금은 진행 불가능


완료
   ↓
더 이상 실행할 필요 없음
```

Coroutine은 **중단되고 재개될 수 있는 실행 흐름**을 제공하지만, 여러 실행 흐름을 각각 하나의 작업으로 관리하는 역할까지 담당하지는 않는다.

그래서 `asyncio`에서는 Coroutine의 실행을 관리하기 위한 별도의 객체를 사용한다.

그 객체가 **Task**다.

---

## 2. Coroutine을 직접 `await`하면 완료될 때까지 다음 코드로 진행하지 않는다

먼저 Task를 사용하지 않는 경우부터 살펴보자.

사용자 정보와 게시글 목록을 가져오는 두 Coroutine이 있다고 해보자.

```python
import asyncio


async def fetch_user():
    print("user start")
    await asyncio.sleep(2)
    print("user end")
    return "user"


async def fetch_posts():
    print("posts start")
    await asyncio.sleep(1)
    print("posts end")
    return "posts"
```

두 Coroutine을 차례대로 `await`해보자.

```python
async def main():
    user = await fetch_user()
    posts = await fetch_posts()

    print(user)
    print(posts)
```

`await fetch_user()`에서는 먼저 `fetch_user()`가 호출된다.

`async def`로 정의된 함수를 호출했기 때문에 함수 본문이 바로 실행되는 것이 아니라 Coroutine Object가 만들어진다.

```text
fetch_user()
      ↓
Coroutine Object 생성
```

그리고 `main()`은 이 Coroutine Object를 `await`한다.

```text
main Coroutine
      ↓
fetch_user() 호출
      ↓
Coroutine Object 생성
      ↓
    await
      ↓
fetch_user Coroutine 실행
```

`fetch_user()` 안에서는 다음 코드가 실행된다.

```python
print("user start")
await asyncio.sleep(2)
print("user end")
return "user"
```

`asyncio.sleep(2)`를 기다려야 하는 동안 `fetch_user` Coroutine은 실행을 중단할 수 있다.

그리고 `main()` 역시 `fetch_user`의 완료를 기다리고 있기 때문에 아직 다음 줄로 진행하지 않는다.

```text
main Coroutine

await fetch_user()
       │
       ▼
fetch_user Coroutine
       │
       ├── "user start"
       │
       ├── await sleep(2)
       │        ↓
       │     suspend
       │
       ├── resume
       │
       ├── "user end"
       │
       └── return "user"
                │
                ▼
          fetch_user 완료
                │
                ▼
main Coroutine 계속 실행
```

그제야 다음 코드가 실행된다.

```python
posts = await fetch_posts()
```

따라서 전체 흐름은 다음과 같다.

```text
main
 │
 ├─ await fetch_user()
 │        ↓
 │   fetch_user 실행
 │        ↓
 │   fetch_user 완료
 │
 ├─ await fetch_posts()
 │        ↓
 │   fetch_posts 실행
 │        ↓
 │   fetch_posts 완료
 │
 ├─ print(user)
 └─ print(posts)
```

실행 결과도 순차적이다.

```text
user start
user end
posts start
posts end
user
posts
```

두 작업은 서로 의존하지 않지만 실행은 순서대로 진행된다.

```text
시간 ───────────────────→

fetch_user
████████████

            fetch_posts
            ██████
```

`fetch_user()`가 `asyncio.sleep(2)`에서 실행을 양보한다고 해서 `fetch_posts()`가 자동으로 실행되는 것은 아니다.

`fetch_posts()`는 아직 호출되어 `await`되거나 Task로 스케줄링되지 않았기 때문이다.

`await`는 현재 Coroutine이 기다리는 동안 다른 **이미 스케줄링된 작업**이 실행될 수 있게 하지만, 뒤에 있는 Coroutine을 자동으로 별도의 작업으로 실행해주는 것은 아니다.

---

## 3. 여러 Coroutine을 함께 진행하려면 Task로 스케줄링한다

사용자 정보를 가져오는 동안 게시글 목록도 함께 가져오고 싶다면 두 Coroutine을 먼저 각각의 **Task**로 만들 수 있다.

```python
async def main():
    user_task = asyncio.create_task(fetch_user())
    posts_task = asyncio.create_task(fetch_posts())

    user = await user_task
    posts = await posts_task

    print(user)
    print(posts)
```

`fetch_user()`부터 살펴보자.

```python
user_task = asyncio.create_task(fetch_user())
```

먼저 `fetch_user()`가 호출되어 Coroutine Object가 만들어진다.

```text
fetch_user()
      ↓
Coroutine Object
```

그리고 `create_task()`가 이 Coroutine을 Task로 만들어 Event Loop에 스케줄링한다.

```text
fetch_user()
      ↓
Coroutine Object
      ↓
create_task()
      ↓
User Task
      ↓
Event Loop에 스케줄링
```

`fetch_posts()`도 같은 과정을 거친다.

```text
fetch_posts()
      ↓
Coroutine Object
      ↓
create_task()
      ↓
Posts Task
      ↓
Event Loop에 스케줄링
```

이제 두 Coroutine은 각각 별도의 Task가 되었다.

```text
             Event Loop
                  │
          ┌───────┴───────┐
          ▼               ▼
     User Task        Posts Task
          │               │
          ▼               ▼
   fetch_user()     fetch_posts()
```

User Task가 먼저 실행된다고 해보자.

```text
User Task
   ↓
"user start"
   ↓
await sleep(2)
   ↓
waiting
```

User Task가 기다리는 동안 Event Loop는 Posts Task를 진행할 수 있다.

```text
Posts Task
    ↓
"posts start"
    ↓
await sleep(1)
    ↓
waiting
```

실행 결과는 대략 다음과 같다.

```text
user start
posts start
posts end
user end
user
posts
```

두 작업의 기다리는 시간이 겹칠 수 있다.

```text
시간 ───────────────────→

User Task
████████████

Posts Task
██████
```

직접 `await`했을 때와 비교하면 차이가 더 명확하다.

```text
await fetch_user()
──────────────────────────
Coroutine을 만들고
현재 실행 흐름에서 바로 기다린다.


create_task(fetch_user())
──────────────────────────
Coroutine을 Task로 만들어
Event Loop에 먼저 스케줄링한다.
```

직접 `await`하는 경우에는 현재 Coroutine이 그 작업의 완료를 기다린 뒤 다음 코드로 진행한다.

반면 `create_task()`를 사용하면 Coroutine을 먼저 별도의 작업으로 스케줄링해 둘 수 있다.

그 결과 여러 Coroutine이 서로 독립적인 Task로 존재하면서 함께 진행될 수 있다.

```text
Coroutine
──────────────────────────
중단되고 재개될 수 있는
비동기 실행 흐름


        create_task()
             ↓


Task
──────────────────────────
Event Loop에 스케줄링되어
다른 Task와 함께 진행되는 작업
```

따라서 Task가 필요한 이유를 한 문장으로 정리하면 다음과 같다.

> **Task는 Coroutine을 별도의 작업으로 스케줄링하여 다른 Task들과 함께 진행할 수 있게 한다.**

Coroutine은 실행 흐름 자체를 표현하고, Task는 그 실행 흐름을 **독립적으로 스케줄링되는 작업**으로 다룰 수 있게 한다.

---

## 4. Task는 작업을 진행하는 시점과 결과가 필요한 시점을 분리한다

앞에서는 두 Coroutine을 먼저 Task로 만들어 Event Loop에 스케줄링했다.

```python
async def main():
    user_task = asyncio.create_task(fetch_user())
    posts_task = asyncio.create_task(fetch_posts())

    user = await user_task
    posts = await posts_task

    print(user)
    print(posts)
```

여기서 주목할 부분은 `create_task()`와 `await`가 서로 다른 시점에 사용된다는 것이다.

```python
user_task = asyncio.create_task(fetch_user())

# ...

user = await user_task
```

앞에서 살펴봤듯이 `create_task()`는 Coroutine을 Task로 만들어 Event Loop에 스케줄링한다.

따라서

```python
user = await user_task
```

에 도달했을 때 User Task의 실행이 처음 시작되는 것은 아니다.

User Task는 이미 앞에서 스케줄링되어 실행이 진행될 수 있는 상태였다.

```text
create_task(fetch_user())
        ↓
User Task 스케줄링
        ↓
Task 실행 진행
        ↓
        ...
        ↓
await user_task
```

그렇다면 `await user_task`는 무엇을 의미할까?

`await user_task`는 **현재 실행 흐름에서 User Task의 완료 결과가 필요한 지점**이다.

```python
user = await user_task
```

이 시점에는 두 가지 경우가 있을 수 있다.

먼저 User Task가 아직 완료되지 않은 경우다.

```text
main Task
    ↓
await user_task
    ↓
User Task 미완료
    ↓
main Task 중단
    ↓
User Task의 완료를 기다림
```

여기서 `main()` 역시 Event Loop에서 실행되는 하나의 Task다.

`main()`은 User Task의 결과가 필요하기 때문에 더 이상 다음 코드로 진행할 수 없다.

하지만 main Task가 기다린다고 해서 다른 Task까지 함께 멈추는 것은 아니다. Event Loop는 그동안 다른 실행 가능한 Task를 계속 진행할 수 있다.

```text
main Task
────────────────────
await user_task
        ↓
     waiting


User Task
────────────────────
     진행 중


Posts Task
────────────────────
     진행 가능
```

예를 들어 User Task보다 Posts Task가 먼저 완료될 수도 있다.

```text
main Task
────────────────────
await user_task
        ↓
User Task를 기다리는 중


User Task
────────────────────
네트워크 응답을 기다리는 중
        ↓ 
아직 미완료


Posts Task
────────────────────
게시글 응답 도착
        ↓
       완료
        ↓
결과: "posts"
```

이 경우 Posts Task는 이미 완료되었지만, main Task는 여전히

```python
user = await user_task
```

에서 User Task의 완료를 기다리고 있다.

`await user_task`는 **User Task의 완료를 기다리는 것**이기 때문에 Posts Task가 먼저 완료되었다고 해서 다음 코드로 넘어가지는 않는다.

시간이 지나 User Task도 완료되면 main Task가 다시 진행할 수 있다.

```text
User Task
    ↓
   완료
    ↓
   결과: "user"
    ↓
main Task 다시 진행 가능
```

그러면

```python
user = await user_task
```

에서 User Task의 결과를 얻고 다음 코드로 진행한다.

```python
posts = await posts_task
```

그런데 Posts Task는 앞에서 이미 완료된 상태다.

```text
Posts Task
    ↓
이미 완료
    ↓
결과: "posts"
    ↓
await posts_task
    ↓
결과 바로 반환
    ↓
posts = "posts"
```

따라서 전체 흐름을 연결하면 다음과 같다.

```text
User Task
────────────────────────────
실행 ─────── 기다림 ─────── 완료
                              │
                              ▼
                         user = "user"


Posts Task
────────────────────────────
실행 ─── 완료
          │
          └──── 결과를 가지고 있음
                              │
                              ▼
                     await posts_task
                              │
                              ▼
                       posts = "posts"


main Task
────────────────────────────
await user_task
      │
      │ User Task를 기다림
      │
      │     Posts Task는 먼저 완료
      │
      ▼
User Task 완료
      ↓
user 결과 사용
      ↓
await posts_task
      ↓
이미 완료되어 있으므로
결과 바로 사용
```

이 예시에서 중요한 점은 **각 Task가 서로 독립적으로 진행되고 완료될 수 있다는 것**이다.

`main()`이 User Task를 기다리고 있는 동안 Posts Task가 먼저 완료될 수 있고, 그 결과는 이후 `await posts_task`에서 사용할 수 있다.

반대로 `await user_task`에 도달했을 때 User Task가 이미 완료되어 있을 수도 있다.

```text
User Task
    ↓
이미 완료
    ↓
결과: "user"


main Task
    ↓
await user_task
    ↓
결과 바로 반환
    ↓
user = "user"
```

이 경우에는 기다릴 필요 없이 완료된 결과를 바로 얻는다.

따라서 Task를 사용할 때는 **작업을 진행하도록 만드는 시점과 그 작업의 결과가 필요한 시점**을 구분해서 생각할 수 있다.

```text
create_task()
────────────────────────
작업을 먼저 스케줄링한다.


        ↓

그동안 Task가 진행될 수 있다.


        ↓

   await task
────────────────────────
현재 실행 흐름에서
그 Task의 완료 결과가 필요하다.
```

즉 `await task`는 Task를 처음 실행시키는 명령이 아니다.

Task는 이미 스케줄링되어 진행되고 있으며, `await task`는 **그 Task의 완료가 현재 실행 흐름에 필요한 지점**이다.

```text
작업을 먼저 스케줄링
        ↓
   create_task()
        ↓
    Task 진행
        ↓
       ...
        ↓
  결과가 필요한 시점
        ↓
    await task
        ↓
     결과 사용
```

이렇게 Task를 사용하면 **작업을 진행하는 시점과 그 결과를 사용하는 시점을 분리할 수 있다.**

그리고 Task의 완료를 기다릴 수 있으려면 그 작업이 아직 진행 중인지, 완료되었는지, 완료되었다면 어떤 결과를 가졌는지와 같은 **완료 상태**를 다룰 수 있어야 한다.

이 완료 상태를 이해하기 위해 다음으로 `Future`를 살펴본다.

---
## 5. Future는 아직 완료되지 않은 결과를 표현한다

앞에서는 Task를 `await`하면 Task가 완료될 때까지 기다리고, 완료되면 결과를 얻을 수 있다는 것을 살펴봤다.

```python
user = await user_task
```

이때 Task가 아직 완료되지 않았다면 결과도 아직 존재하지 않는다.

```text
User Task
    ↓
진행 중
    ↓
아직 결과 없음
    ↓
시간이 지나면
    ↓
완료
    ↓
결과 또는 예외
```

비동기 프로그램에서는 이처럼 **지금은 존재하지 않지만 나중에 만들어질 결과**를 다뤄야 하는 경우가 많다.

이러한 미래의 완료 상태와 결과를 표현하는 객체가 `Future`다.

Future는 처음에는 `pending` 상태일 수 있다.

```text
Future
  │
  └── pending
```

아직 완료되지 않았고 결과도 준비되지 않은 상태다.

작업이 완료되면 Future는 `done` 상태가 된다.

```text
Future

pending
   ↓
 done
   │
   ├── result
   └── exception
```

정상적으로 완료되었다면 결과를 가질 수 있고, 문제가 발생했다면 예외를 가질 수 있다.

Future의 상태 변화를 간단한 코드로 확인해보자.

```python
async def main():
    loop = asyncio.get_running_loop()

    future = loop.create_future()

    print(future.done())  # False

    future.set_result("user")

    print(future.done())  # True

    result = await future
    print(result)         # user
```

Future를 처음 만들었을 때는 아직 결과가 없다.

```python
future = loop.create_future()
```

```text
Future
  ↓
pending
```

이후 예제에서는 직접 결과를 설정한다.

```python
future.set_result("user")
```

그러면 Future가 완료된다.

```text
Future
pending
   ↓
set_result("user")
   ↓
 done
   ↓
result = "user"
```

다만 이 코드는 **Future의 상태 변화를 직접 확인하기 위한 학습용 예제**다.

일반적인 애플리케이션 코드에서 Future를 직접 생성하고 `set_result()`를 호출하는 경우는 많지 않다.

Future의 핵심은 다음처럼 정리할 수 있다.

```text
Future
────────────────────────
지금은 결과가 없지만
나중에 완료될 수 있는 객체

pending
   ↓
 done
   ↓
result / exception
```

그렇다면 일반적인 코드에서 자주 직접 사용하지 않는 Future가 비동기 실행 구조에는 왜 필요한 걸까?

---
## 6. Future는 비동기 실행의 한 단계 아래에서 자주 사용된다

일반적인 `asyncio` 애플리케이션을 작성할 때 개발자가 주로 다루는 것은 Coroutine과 Task다.

예를 들어 다음과 같은 코드를 작성할 수 있다.

```python
async def fetch_user():
    user = await db.get_user()
    return user


async def main():
    user_task = asyncio.create_task(fetch_user())

    user = await user_task
    print(user)
```

개발자가 직접 보는 구조는 대략 다음과 같다.

```text
main()
   ↓
main Task
   ↓
User Task
   ↓
fetch_user() Coroutine
   ↓
await db.get_user()
```

여기서 `db.get_user()` 역시 비동기 라이브러리가 제공하는 Coroutine이나 다른 Awaitable일 수 있다.

하지만 그 아래에서는 실제 DB와 통신하기 위한 네트워크 I/O가 필요할 수 있다.

```text
Application Code
────────────────────────

main Task
    ↓
fetch_user()
    ↓
await db.get_user()


Async Library / Runtime
────────────────────────

네트워크 I/O
    ↓
아직 결과 없음
    ↓
Future 등의 완료 상태


OS
────────────────────────

Socket / Network I/O
```

즉 개발자가 작성하는 비동기 로직에서는 주로 Coroutine과 Task가 보이지만, **그 아래의 비동기 라이브러리나 Event Loop에 가까운 영역에서는 Future가 사용될 수 있다.**

Future는 특히 **지금은 결과가 없지만 나중에 완료될 작업의 상태와 결과를 표현해야 할 때** 유용하다.

예를 들어 네트워크 요청을 시작했다고 해보자.

```text
네트워크 요청 시작
        ↓
현재는 응답 없음
        ↓
       ...
        ↓
네트워크 응답 도착
        ↓
    결과 생성
```

네트워크 요청을 시작한 시점에는 아직 결과가 없다.

하지만 결과를 기다리고 있는 Task는 나중에 응답이 도착하면 다시 실행되어야 한다.

이 두 시점을 Future와 같은 객체를 통해 연결할 수 있다.

```text
결과를 기다리는 쪽
Coroutine / Task
        │
        │ await
        ▼
     Future
     pending
        │
        │
        │ 작업 완료
        ▼
     Future
      done
        │
        │ result
        ▼
기다리던 Task
다시 실행 가능
```

조금 다른 관점에서 보면 다음과 같다.

```text
결과를 만들어내는 쪽
비동기 라이브러리 / Event Loop
          │
          │ 완료
          ▼
       Future
   pending → done
          ▲
          │ 기다림
          │
     Coroutine / Task
결과를 기다리는 쪽
```

따라서 Future가 표현하는 것은 **실행할 비동기 코드 자체가 아니다.**

```text
Coroutine
────────────────────────
중단되고 재개될 수 있는
비동기 실행 흐름


Task
────────────────────────
Coroutine을 독립적인
작업으로 실행하고 관리


Future
────────────────────────
나중에 완료될
상태와 결과
```

이 차이 때문에 Coroutine이 존재하는 일반적인 애플리케이션 코드에서는 Task를 사용하는 경우가 많다.

```python
task = asyncio.create_task(fetch_user())
```

반면 Future는 **실행할 Coroutine을 만들기보다 나중에 발생할 완료와 결과 자체를 표현해야 하는 영역**에서 더 자주 등장한다.

예를 들어 다음과 같은 영역이다.

```text
비동기 라이브러리 내부

Event Loop와 가까운 저수준 코드

Callback 기반 API와 asyncio의 연결

외부 이벤트의 완료를 await 가능한 형태로 표현
```

따라서 일반적인 애플리케이션 개발자는 Future를 직접 설계하지 않고도 `asyncio`를 충분히 사용할 수 있다.

```text
Application Developer
────────────────────────
Coroutine
Task
await

        ↓

Async Library / Runtime
────────────────────────
Future
Event Loop
I/O completion

        ↓

Operating System
────────────────────────
Socket
Network
I/O
```

물론 비동기 라이브러리를 직접 만들거나, Callback 기반 시스템을 `asyncio`와 연결하는 등 더 낮은 수준의 비동기 구조를 설계한다면 Future를 직접 사용할 수도 있다.

하지만 지금 단계에서는 Future를 **Task와 나란히 놓고 선택해서 사용하는 애플리케이션 도구**로 생각할 필요는 없다.

Future의 위치는 다음처럼 이해하는 것이 더 중요하다.

> **애플리케이션에서는 주로 Coroutine과 Task를 다루고, 그 아래에서는 Future가 아직 완료되지 않은 결과를 표현하며 비동기 실행을 연결할 수 있다.**

---
## 7. Future의 완료는 기다리던 Task의 재개로 이어진다

Future를 애플리케이션 코드에서 직접 사용하는 경우는 많지 않지만, Future도 `await`할 수 있는 객체다.

이 성질은 Future를 직접 사용하는 방법을 익히기보다 **비동기 시스템에서 완료와 재개가 어떻게 연결되는지 이해하기 위해 중요하다.**

개념적으로 다음과 같은 코드가 있다고 해보자.

```python
result = await future
```

Future가 이미 완료되어 있다면 결과를 바로 얻을 수 있다.

```text
await future
     ↓
Future done
     ↓
result 바로 반환
```

반대로 Future가 아직 `pending`이라면 결과가 준비되지 않았다.

```text
await future
     ↓
Future pending
     ↓
아직 결과 없음
```

현재 Task는 그 결과가 필요하기 때문에 더 이상 다음 코드로 진행할 수 없다.

따라서 현재 Coroutine의 실행이 중단된다.

```text
현재 Task
    ↓
await future
    ↓
Future pending
    ↓
Coroutine suspend
    ↓
Future 완료를 기다림
```

그동안 Event Loop는 다른 실행 가능한 Task를 진행할 수 있다.

```text
Task A
────────────────────
await future
     ↓
  waiting


Task B
────────────────────
실행 가능
     ↓
   running
```

시간이 지나 비동기 작업이 완료되고 Future도 완료되었다고 해보자.

```text
비동기 작업 완료
      ↓
    Future
pending → done
      ↓
result 준비
```

그러면 Future를 기다리고 있던 Task도 다시 실행할 수 있게 된다.

```text
Future done
    ↓
기다리던 Task
다시 실행 가능
    ↓
Event Loop
    ↓
Task 실행
    ↓
Coroutine resume
    ↓
result 획득
```

전체 흐름은 다음과 같다.

```text
Task
  ↓
await Future
  ↓
Future pending
  ↓
Coroutine suspend
  ↓
       ...
  ↓
Future done
  ↓
Task 다시 실행 가능
  ↓
Event Loop
  ↓
Coroutine resume
  ↓
result
```

여기서 `await`가 Future를 완료시키는 것은 아니다.

```text
await Future
────────────────────────
Future를 완료시킨다  X

Future가 완료될 때까지
현재 실행 흐름이 기다린다  O
```

Future의 결과는 비동기 시스템의 다른 부분에서 준비된다.

그리고 Future가 완료되면 그것을 기다리던 Task가 다시 실행될 수 있게 된다.

이 흐름을 이해하면 실제 애플리케이션 코드에서 Future를 직접 보지 않더라도, `await` 아래에서 **비동기 작업의 완료와 Coroutine의 재개가 어떻게 연결될 수 있는지** 이해할 수 있다.

---

## 8. Task는 Coroutine을 실행하면서 Future의 성격도 가진다

앞에서 Future는 미래의 완료 상태와 결과를 표현한다고 했다.

```text
Future
────────────────────────
pending
   ↓
  done
   ↓
result / exception
```

Task 역시 완료되기 전과 완료된 후가 존재하고, 완료되면 결과나 예외를 가진다.

```text
Task
────────────────────────
진행 중
   ↓
  완료
   ↓
result / exception
```

그래서 앞에서 다음과 같이 Task를 `await`할 수 있었다.

```python
task = asyncio.create_task(fetch_user())

user = await task
```

Task가 아직 완료되지 않았다면 현재 실행 흐름은 Task의 완료를 기다린다.

Task가 완료되면 그 결과를 얻을 수 있다.

하지만 Task에는 Future와 구분되는 중요한 역할이 하나 더 있다.

**Task는 Coroutine의 실행을 실제로 진행하고 관리한다.**

```text
Task
 │
 └── Coroutine
        │
        ▼
      running
        │
        ▼
       await
        │
        ▼
      waiting
        │
        ▼
      running
        │
        ▼
       done
```

그리고 Coroutine의 실행이 끝나면 Task 자체도 완료된다.

```text
Task
 │
 ├── Coroutine 실행 관리
 │
 └── 완료 상태 관리
          │
          ├── result
          └── exception
```

따라서 Future와 Task의 중심 역할을 다음처럼 구분할 수 있다.

```text
Future
────────────────────────
미래의 완료 상태와
결과를 표현


Task
────────────────────────
Coroutine의 실행을 관리
        +
완료 상태와 결과도 관리
```

Python의 `asyncio.Task`는 Future가 가진 완료 상태와 결과를 다루는 성격에 **Coroutine을 실행하는 역할까지 더해진 객체**라고 이해할 수 있다.

그래서 Task와 Future 모두 `await`할 수 있다.

Coroutine Object 역시 `await`할 수 있었다.

```python
await coroutine
await task
await future
```

Python에서는 이처럼 **`await`할 수 있는 객체를 Awaitable**이라고 한다.

```text
               Awaitable
              "await 가능"

        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
   Coroutine    Task    Future
```

Awaitable은 Coroutine, Task, Future와 같은 또 하나의 실행 객체를 의미하는 것이 아니다.

이 객체들이 **`await`할 수 있다는 공통적인 성질**을 나타내는 개념이다.

```text
Coroutine
→ 중단되고 재개될 수 있는 실행 흐름

Task
→ Coroutine의 실행과 완료 상태를 관리

Future
→ 미래의 완료 상태와 결과

Awaitable
→ await할 수 있는 객체
```

이제 여러 Coroutine이 각각 Task로 스케줄링되었다고 해보자.

어떤 Task는 지금 실행할 수 있고, 어떤 Task는 Future와 같은 Awaitable의 완료를 기다리고 있을 수 있다.

이러한 여러 Task의 실행을 실제로 조율하는 주체가 **Event Loop**다.

---
## 9. Event Loop는 실행 가능한 Task를 스케줄링한다

여러 Coroutine이 각각 Task로 관리되고 있다고 해보자.

```text
Task A

Task B

Task C
```

각 Task는 서로 다른 상태에 있을 수 있다.

```text
Task A → ready

Task B → waiting

Task C → ready
```

`ready` 상태의 Task는 지금 실행을 진행할 수 있다.

반면 `waiting` 상태의 Task는 기다리던 작업이 준비되기 전까지 더 진행할 수 없다.

이러한 Task들의 실행을 조율하는 중심에 **Event Loop**가 있다.

```text
             Event Loop
                  │
             scheduling
                  │
          ┌───────┴───────┐
          ▼               ▼
       Task A           Task C
       ready            ready
```

Event Loop는 실행 가능한 작업을 진행시킨다.

```text
Event Loop
    ↓
 Task A
    ↓
Coroutine A 실행
```

Coroutine A가 실행되다가 `await`에서 실제로 기다려야 한다고 해보자.

```text
Task A
  ↓
Coroutine A
  ↓
await
  ↓
waiting
```

Task A는 당장 더 진행할 수 없다.

그동안 Event Loop는 다른 실행 가능한 Task를 진행할 수 있다.

```text
Task A → waiting

Task B → ready ──→ running

Task C → ready
```

즉 Event Loop의 핵심 역할은 **현재 실행할 수 있는 Task들의 실행을 적절한 시점에 진행시키는 것**이다.

---
## 10. 기다리던 작업이 완료되면 Task는 다시 실행 가능해진다

실제 비동기 프로그램에서는 네트워크 같은 I/O를 기다리는 경우가 많다.

```python
data = await async_request()
```

결과가 아직 준비되지 않았다면 현재 Task는 더 이상 실행을 계속할 수 없다.

```text
Task A
  ↓
Coroutine 실행
  ↓
await I/O
  ↓
waiting
```

그동안 네트워크 작업 자체를 Python 코드가 계속 수행하고 있는 것은 아니다.

운영체제와 외부 시스템에서 I/O가 진행되는 동안 Event Loop는 다른 실행 가능한 Task를 진행할 수 있다.

```text
Task A → waiting

Task B → running

Task C → ready
```

운영체제는 네트워크 I/O의 준비나 완료를 감지할 수 있는 기능을 제공한다.

Event Loop는 이러한 기능을 이용해 기다리던 작업이 다시 진행될 수 있는 시점을 확인한다.

플랫폼에 따라 내부적으로 `epoll`, `kqueue`, IOCP 같은 메커니즘이 사용될 수 있다.

개념적으로는 다음 정도로 생각하면 충분하다.

```text
Event Loop
    │
    │ I/O 관심 등록
    ▼
    OS
    │
    │ I/O 준비 / 완료
    ▼
 Event 발생
```

기다리던 I/O가 완료되면 관련 Future 등의 완료 상태가 갱신될 수 있다.

```text
I/O 완료
   ↓
Future 완료
   ↓
기다리던 Task
   ↓
ready
```

여기서 중요한 것은 I/O가 완료되었다고 해서 해당 Coroutine이 그 순간 바로 실행되는 것은 아니라는 점이다.

먼저 Task가 **다시 실행 가능한 상태**가 된다.

```text
Task
waiting
   ↓
기다리던 작업 완료
   ↓
ready
```

그리고 Event Loop의 스케줄링을 통해 실제 실행이 다시 진행된다.

```text
Task ready
    ↓
Event Loop
    ↓
scheduling
    ↓
Task 실행
    ↓
Coroutine resume
```

전체 흐름을 연결하면 다음과 같다.

```text
Task A
  ↓
running
  ↓
await
  ↓
waiting
  │
  │    다른 Task 실행
  │
  ▼
기다리던 작업 완료
  ↓
ready
  ↓
Event Loop
  ↓
scheduling
  ↓
running
  ↓
Coroutine resume
```

Event Loop는 Coroutine을 처음부터 다시 호출하는 것이 아니다.

**Task가 관리하고 있던 Coroutine의 중단된 실행을 다시 진행시킨다.**

---

## 11. Event Loop는 하나의 Thread에서도 여러 Task를 번갈아 진행할 수 있다

Event Loop가 여러 Task를 실행한다고 해서 반드시 여러 CPU Core에서 Python 코드가 동시에 실행된다는 뜻은 아니다.

하나의 Event Loop Thread를 기준으로 보면 여러 Task가 번갈아 진행될 수 있다.

```text
시간 ─────────────────────────────→

Task A
██████ await.................████

Task B
      ████ await.....████

Task C
          █████ await......██
```

한 Task가 `await`에서 기다려야 하면 다른 실행 가능한 Task가 진행된다.

```text
Task A
   ↓
await
   ↓
waiting

        Task B
           ↓
        running

                Task C
                   ↓
                running
```

이처럼 여러 작업이 일정 시간 동안 겹쳐서 진행되는 것을 **Concurrency**, 즉 동시성이라고 한다.

반면 여러 CPU Core에서 실제로 같은 순간에 여러 계산을 수행하는 것은 **Parallelism**, 즉 병렬성의 문제다.

```text
Concurrency
────────────────────────
여러 작업의 실행이
시간적으로 겹쳐 진행됨


Parallelism
────────────────────────
여러 작업이 실제로
같은 순간에 실행됨
```

Event Loop 기반 비동기 실행은 주로 I/O를 기다리는 시간을 다른 작업의 실행에 활용한다.

```text
Task A → I/O 기다림
             ↓
Task B → 실행
             ↓
Task B → I/O 기다림
             ↓
Task C → 실행
```

이를 통해 하나의 Event Loop에서도 여러 I/O 중심 작업을 효율적으로 진행할 수 있다.

---
## 12. 전체 비동기 실행 흐름을 연결해보자

이제 지금까지 살펴본 구조를 하나로 연결할 수 있다.

먼저 `async def`로 정의된 Coroutine Function을 호출한다.

```text
Coroutine Function
       │
       │ call
       ▼
Coroutine Object
```

Coroutine을 독립적인 작업으로 진행하려면 Task로 스케줄링할 수 있다.

```text
Coroutine Object
       │
       │ create_task()
       ▼
     Task
```

Task는 Event Loop에 스케줄링된다.

```text
Task
 ↓
Event Loop
 ↓
scheduling
 ↓
Coroutine 실행
```

Coroutine이 실행되다가 `await`를 만난다.

기다릴 필요가 없다면 결과를 얻고 그대로 계속 진행할 수 있다.

반대로 아직 완료되지 않은 비동기 작업을 기다려야 한다면 Coroutine의 실행을 중단한다.

앞에서 살펴본 Future를 이용해 이 과정을 개념적으로 표현하면 다음과 같다.

```text
Coroutine 실행
       │
       ▼
     await
       │
       ├── 이미 완료됨
       │        ↓
       │     결과 획득
       │        ↓
       │     계속 실행
       │
       └── 아직 미완료
                ↓
          Future pending
                ↓
             suspend
                ↓
           Task waiting
```

여기서 Future는 **아직 완료되지 않은 비동기 작업의 상태와 결과를 표현하는 예시**다.

실제 `await`의 대상은 Coroutine, Task, Future 등 다양한 Awaitable일 수 있으며, 애플리케이션 코드에서 Future를 직접 다루지 않더라도 비동기 라이브러리나 Event Loop에 가까운 내부에서는 이러한 완료 상태가 사용될 수 있다.

Task가 기다리는 동안 Event Loop는 다른 실행 가능한 Task를 진행할 수 있다.

```text
Task A → waiting

Task B → running

Task C → ready
```

시간이 지나 기다리던 작업이 완료되면 Future도 완료 상태가 될 수 있다.

```text
기다리던 작업 완료
        ↓
   Future done
        ↓
    Task ready
```

여기서 Task가 바로 실행되는 것은 아니다.

Task는 다시 **실행 가능한 상태**가 되고, Event Loop의 스케줄링을 통해 실행 기회를 얻는다.

```text
Future done
     ↓
Task ready
     ↓
Event Loop
     ↓
scheduling
     ↓
Task running
     ↓
Coroutine resume
```

그러면 Coroutine은 처음부터 다시 실행되는 것이 아니라 `await`로 중단했던 실행 흐름을 이어간다.

전체를 하나로 연결하면 다음과 같다.

```text
Coroutine Function
       │
       │ call
       ▼
Coroutine Object
       │
       │ create_task()
       ▼
     Task
       │
       ▼
   Event Loop
       │
   scheduling
       │
       ▼
Coroutine 실행
       │
       ▼
     await
       │
       ├── 이미 완료됨
       │        ↓
       │     결과 획득
       │        ↓
       │     계속 실행
       │
       └── 아직 미완료
                ↓
          Future pending
                ↓
             suspend
                ↓
           Task waiting
                │
                │
          다른 Task 실행
                │
                ▼
        기다리던 작업 완료
                ↓
           Future done
                ↓
           Task ready
                ↓
           Event Loop
                ↓
           scheduling
                ↓
          Task running
                ↓
        Coroutine resume
                ↓
            결과 획득
                ↓
            계속 실행
```

이제 `await`를 기준으로 앞뒤가 연결된다.

```text
             await
               │
               ▼
        Future pending
               │
               ▼
           suspend
               │
               ▼
         Task waiting
               │
               │
          작업 완료
               │
               ▼
         Future done
               │
               ▼
          Task ready
               │
               ▼
          Event Loop
               │
               ▼
            resume
```

08편에서 살펴본 Coroutine의 `suspend`와 `resume`은 이 실행 시스템 안에서 여러 Task의 동시성으로 확장된다.

Coroutine 하나가 중단될 수 있기 때문에 Event Loop는 그 시간을 다른 Task의 실행에 사용할 수 있다.

```text
Coroutine의 중단과 재개
          +
Task 단위의 실행 관리
          +
Future의 pending / done
          +
Event Loop의 scheduling
          ↓
여러 비동기 작업의 동시성
```

---

# 정리

Python의 비동기 실행은 Coroutine에서 시작한다.

하지만 Coroutine은 어디까지나 **중단되고 재개될 수 있는 실행 흐름**이다.

여러 Coroutine을 독립적인 비동기 작업으로 진행하기 위해 Task를 사용할 수 있고, Event Loop는 이러한 Task들의 실행을 조율한다.

각 개념의 역할은 다음처럼 구분할 수 있다.

```text
Coroutine
→ 중단되고 재개될 수 있는 비동기 실행 흐름


Task
→ Coroutine을 독립적인 작업으로 실행하고 관리


Future
→ 미래의 완료 상태와 결과


Awaitable
→ await할 수 있는 객체


Event Loop
→ 실행 가능한 Task의 실행을 조율
```

전체적인 실행 흐름을 단순화하면 다음과 같다.

```text
Coroutine
    ↓
  Task
    ↓
Event Loop
    ↓
 running
    ↓
  await
    ↓
Future pending
    ↓
 suspend
    ↓
Task waiting
    ↓
기다리던 작업 완료
    ↓
Future done
    ↓
Task ready
    ↓
Event Loop
    ↓
 resume
```

다만 이 도식의 `Future`는 **비동기 작업의 완료 상태를 보여주기 위한 대표적인 예시**다.

모든 애플리케이션 코드에서 Future를 직접 생성해야 한다는 의미는 아니다. 일반적인 개발에서는 주로 Coroutine, Task, `await`를 사용하고, Future는 그보다 한 단계 아래의 비동기 라이브러리나 실행 시스템에서 자주 등장한다.

한 Task가 기다리는 동안 다른 Task가 진행될 수 있기 때문에 하나의 Event Loop에서도 여러 I/O 중심 작업을 동시에 진행할 수 있다.

다음 글에서는 이 실행 모델을 운영체제의 Thread와 비교하면서, **Coroutine 기반 동시성과 Thread 기반 동시성이 어떻게 다른지** 살펴본다.

---
**다음 글 : 10. Python에서 Thread는 어떻게 실행되는가?**