---
title: "07. Generator는 실행을 어떻게 멈췄다가 다시 시작하는가"

description: "Python Generator가 yield를 통해 실행을 중단하고 상태를 보존한 뒤, next() 호출에서 다시 실행을 이어가는 suspend와 resume의 동작 원리를 이해합니다."

pubDatetime: 2026-09-08T15:34:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Generator
  - yield
  - suspend
  - resume

draft: false
---

앞에서 Iterator를 살펴보면서 Python의 `for`문이 내부적으로 `iter()`와 `next()`를 이용해 값을 하나씩 가져온다는 것을 확인했다.

그렇다면 직접 Iterator를 만들려면 어떻게 해야 할까?

```python
class NumberIterator:
    def __init__(self):
        self.current = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= 3:
            raise StopIteration

        value = self.current
        self.current += 1
        return value
```

Iterator는 다음 값을 반환하기 위해 **현재 어디까지 진행했는지를 객체 내부에 직접 저장해야 한다.**

그런데 Python에는 이 과정을 훨씬 자연스럽게 표현할 수 있는 방법이 있다.

바로 **Generator**다.

```python
def numbers():
    yield 0
    yield 1
    yield 2
```

겉으로 보면 평범한 함수에 `yield`만 추가된 것처럼 보인다.

하지만 `yield`가 등장하는 순간 이 함수의 실행 방식은 완전히 달라진다.

Generator를 이해하는 핵심은 이것이다.

> **Generator는 값을 여러 개 반환하는 함수가 아니라, 실행 상태를 보존한 채 멈췄다가 다시 실행할 수 있는 객체다.**

---

## 1. Generator Function

다음 함수를 살펴보자.

```python
def numbers():
    print("start")
    yield 1
    print("middle")
    yield 2
    print("end")
```

일반적인 함수라면 호출하는 순간 함수의 Frame이 만들어지고 코드가 실행된다.

```python
def add(a, b):
    return a + b

result = add(1, 2)
```

대략 다음 흐름이다.

```text
Function Call
    ↓
 Frame 생성
    ↓
 함수 실행
    ↓
  return
    ↓
Frame 종료
```

하지만 `yield`가 포함된 함수는 **Generator Function**이 된다.

```python
gen = numbers()
```

여기서 중요한 차이가 발생한다.

`numbers()`를 호출했다고 해서 함수 본문이 바로 실행되지 않는다.

대신 Python은 **Generator Object**를 반환한다.

```text
Generator Function
        │
        │ call
        ▼
Generator Object
```

따라서

```python
gen = numbers()
```

을 실행한 직후에는 `"start"`조차 출력되지 않는다.

Generator는 **실행할 준비가 된 상태**로 존재할 뿐이다.

---

## 2. Generator Object

Generator Function을 호출하면 Generator Object가 만들어진다.

```python
gen = numbers()

print(gen)
```

대략 다음과 같은 객체를 확인할 수 있다.

```text
<generator object numbers at 0x...>
```

이 객체가 중요한 이유는 단순히 다음 값을 알고 있기 때문이 아니다.

Generator Object는 **함수 실행을 다시 이어가기 위해 필요한 실행 상태와 연결되어 있다.**

앞에서 Python의 함수 실행을 이해하면서 Frame을 살펴봤다.

Frame에는 함수 실행에 필요한 정보가 들어 있었다.

```text
Frame
 ├─ local variables
 ├─ operand stack
 ├─ instruction position
 └─ execution state
```

일반 함수는 실행을 마치면 해당 호출의 실행 상태가 더 이상 필요하지 않다.

반면 Generator는 다르다.

`yield`에서 실행을 멈췄다가 나중에 다시 시작해야 하기 때문이다.

즉 Generator의 핵심은

```text
Generator Object
       │
       ▼
suspended execution state
```

라고 볼 수 있다.

---

## 3. `yield`는 무엇을 하는가?

이제 Generator를 실행해보자.

```python
gen = numbers()

next(gen)
```

처음 `next()`가 호출되면 Generator Function의 코드가 실행되기 시작한다.

```python
print("start")
yield 1
```

따라서

```text
start
```

가 출력되고 `next()`의 결과로 `1`이 나온다.

하지만 여기서 중요한 것은 **함수가 끝난 것이 아니라는 점**이다.

일반적인 `return`이라면

```python
return 1
```

값을 호출자에게 돌려주면서 현재 함수 호출은 종료된다.

반면

```python
yield 1
```

은 값을 호출자에게 전달하면서 **현재 실행을 일시 중단한다.**

```text
실행
 ↓
print("start")
 ↓
yield 1
 ↓
값 1 전달
 ↓
실행 중단
```

이를 흔히 **suspended execution**, 즉 실행이 **중단된 상태**라고 표현한다.

---

## 4. 어디까지 실행했는지를 어떻게 기억할까?

여기서 Generator의 핵심적인 특징이 나타난다.

```python
def counter():
    x = 10

    yield x

    x += 1
    yield x
```

첫 번째 `yield`에서 실행이 멈췄다고 생각해보자.

Python은 단순히

```text
첫 번째 yield까지 실행했다.
```

정도만 기억하는 것이 아니다.

다시 실행하기 위해 필요한 상태도 보존되어야 한다.

예를 들어

```text
x = 10
현재 실행 위치 = 첫 번째 yield
```

와 같은 정보가 필요하다.

그래야 다음 `next()`에서 처음부터 다시 실행하지 않고

```python
x += 1
```

부터 이어서 실행할 수 있다.

개념적으로 보면 다음과 같다.

```text
Generator Object
      │
      ▼
Execution State
 ├─ local variables
 │    └─ x = 10
 │
 ├─ evaluation state
 │
 └─ resume position
      └─ yield 다음
```

즉 Generator는 **함수 실행의 중간 상태를 보존한다.**

이것이 Generator가 일반 함수와 가장 크게 다른 부분이다.

---

## 5. `next()`를 다시 호출하면 어떻게 될까?

다시 앞의 Generator로 돌아가보자.

```python
def numbers():
    print("start")
    yield 1

    print("middle")
    yield 2

    print("end")
```

먼저

```python
gen = numbers()
```

를 호출한다.

아직 함수 본문은 실행되지 않는다.

그리고

```python
next(gen)
```

을 호출하면

```text
start
```

가 출력되고

```python
yield 1
```

에서 실행이 멈춘다.

현재 상태는 대략 다음과 같다.

```text
print("start")
yield 1          ← suspended here

print("middle")
yield 2

print("end")
```

이제 다시

```python
next(gen)
```

을 호출한다.

Python은 함수를 처음부터 실행하지 않는다.

멈췄던 `yield`의 **다음 지점부터 실행을 재개**(resume)한다.

```text

                  ↓
print("start")
yield 1
                resume
                  ↓
print("middle")
yield 2          ← suspended again
```

따라서 `"start"`는 다시 출력되지 않고

```text
middle
```

만 출력된다.

그리고 `2`를 전달한 뒤 다시 실행이 멈춘다.

이것이 Generator의 핵심적인 실행 구조다.

```text
next()
  ↓
resume
  ↓
execution
  ↓
yield
  ↓
suspend
  ↓

next()
  ↓
resume
  ↓
execution
  ↓
yield
  ↓
suspend
```

Generator는 이 과정을 반복한다.

---

## 6. Generator가 끝나면 어떻게 될까?

마지막으로 한 번 더 호출해보자.

```python
next(gen)
```

두 번째 `yield` 다음부터 실행이 재개된다.

```python
print("end")
```

가 실행되고 함수의 끝에 도달한다.

더 이상 `yield`가 없다.

Generator 역시 Iterator이므로 이때 반복이 끝났다는 사실을 `StopIteration`으로 알린다.

```text
resume
  ↓
print("end")
  ↓
함수 종료
  ↓
StopIteration
```

따라서 전체 흐름은 다음과 같다.

```text
Generator Function
        ↓
 Generator Object
        ↓
      next()
        ↓
	실행 시작
        ↓
	   yield
        ↓
	suspended
        ↓
	  next()
        ↓
	  resume
        ↓
	  yield
        ↓
	suspended
        ↓
	  next()
        ↓
	  resume 
        ↓
	함수 종료
        ↓
  StopIteration
```

앞에서 살펴본 Iterator의 동작과 정확히 연결된다.

---

## 7. 그래서 Generator도 Iterator다

Generator가 `for`문에서 자연스럽게 사용되는 이유도 여기에 있다.

```python
def numbers():
    yield 1
    yield 2
    yield 3

for number in numbers():
    print(number)
```

앞에서 살펴봤듯 `for`문은 개념적으로 Iterator에 계속 `next()`를 호출한다.

```text
for
 ↓
iter()
 ↓
next()
 ↓
next()
 ↓
next()
 ↓
StopIteration
```

Generator Object 역시 Iterator Protocol을 만족한다.

따라서 `for`문이 Generator에 `next()`를 요청할 때마다 Generator는

```text
resume
   ↓
 yield
   ↓
suspend
```

를 반복한다.

결국

```python
for number in numbers():
    print(number)
```

은 개념적으로 다음과 같은 흐름을 가진다.

```text
for
 │
 │ next()
 ▼
Generator
 │
 │ resume
 ▼
yield 1
 │
 │ suspend
 ▼
for

 │ next()
 ▼
Generator
 │
 │ resume
 ▼
yield 2
 │
 │ suspend
 ▼
for

 │ next()
 ▼
Generator
 │
 │ resume
 ▼
yield 3
 │
 │ suspend
 ▼
for

 │ next()
 ▼
Generator
 │
 │ resume
 ▼
StopIteration
```

그래서 Generator를 단순히

> 여러 값을 `yield`하는 특별한 함수

라고 이해하면 핵심을 놓치게 된다.

더 정확하게는

> **실행 상태를 보존하면서 Iterator Protocol에 따라 실행을 조금씩 진행하는 객체**

라고 보는 것이 좋다.

---

## 8. Iterator와 Generator의 차이

앞에서 직접 만든 Iterator를 다시 생각해보자.

```python
class NumberIterator:
    def __init__(self):
        self.current = 0

    def __next__(self):
        if self.current >= 3:
            raise StopIteration

        value = self.current
        self.current += 1
        return value
```

우리는 직접

```python
self.current
```

라는 상태를 만들었다.

그리고 `__next__()`가 호출될 때마다 현재 상태를 확인하고 다음 상태로 변경했다.

Generator에서는 같은 로직을 훨씬 자연스럽게 작성할 수 있다.

```python
def numbers():
    yield 0
    yield 1
    yield 2
```

Generator에서는 **코드가 어디까지 실행되었는지 자체가 상태가 된다.**

Iterator인 경우

```text
Iterator

Object
 └─ current = 1

개발자가 상태를 직접 관리
```

반면 Generator는

```text
Generator

suspended execution
 ├─ local variables
 └─ execution position

Python이 실행 상태를 보존
```

이라는 차이가 있다.

이 때문에 Generator는 복잡한 반복 로직을 구현할 때 특히 강력하다.

---

## 9. Generator는 왜 메모리 효율적이라고 할까?

Generator를 설명할 때 자주 나오는 표현이 있다.

> Generator는 메모리 효율적이다.

예를 들어 백만 개의 숫자를 만들어보자.

```python
numbers = [x for x in range(1_000_000)]
```

List Comprehension은 결과를 담은 리스트를 만든다.

개념적으로

```text
[0, 1, 2, 3, 4, ... 999999]
```

라는 값들이 컨테이너에 저장된다.

반면

```python
numbers = (x for x in range(1_000_000))
```

은 Generator Expression이다.

Generator는 백만 개의 결과를 미리 만들어 저장할 필요가 없다.

```text
next()
 ↓
0 생성

next()
 ↓
1 생성

next()
 ↓
2 생성

...
```

필요할 때마다 실행을 재개하여 다음 값을 만들어낸다.

이를 **lazy evaluation**의 한 형태로 볼 수 있다.

즉 Generator의 메모리 효율성은 단순히 특별한 최적화 때문이라기보다,

> **모든 결과를 미리 만들어 저장하지 않고 필요한 만큼만 계산할 수 있기 때문**

이라고 이해하는 것이 더 중요하다.

---

## 10. `return`과 `yield`의 본질적인 차이

Generator를 이해했다면 `return`과 `yield`의 차이도 훨씬 명확해진다.

```text
return
```

은

```text
값 반환
  +
현재 함수 실행 종료
```

다.

반면

```text
yield
```

는

```text
값 전달
  +
현재 함수 실행 중단
  +
실행 상태 보존
```

이다.

따라서

```text
return
 ↓
function execution finished
```

인 반면

```text
yield
 ↓
function execution suspended
 ↓
resume 가능
```

이라는 차이가 있다.

바로 이 **suspend / resume**가 Generator의 본질이다.

---

## 11. Generator에서 Coroutine으로

여기까지 보면 한 가지 흥미로운 생각을 할 수 있다.

Python은 Generator를 통해 이미 다음과 같은 능력을 가지고 있다.

```text
실행
 ↓
중단
 ↓
상태 보존
 ↓
재개
```

그런데 이것은 단순한 반복에만 사용할 수 있는 개념은 아니다.

예를 들어 어떤 작업을 실행하다가

```text
네트워크 응답을 기다려야 한다.
```

고 생각해보자.

그동안 CPU가 아무것도 하지 않고 기다리는 대신 현재 작업을 잠시 중단하고 다른 작업을 실행할 수 있다면 어떨까?

```text
Task A 실행
    ↓
대기 필요
    ↓
suspend

Task B 실행
    ↓
...

Task A 준비 완료
    ↓
resume
```

Generator에서 살펴본 **suspend / resume라는 실행 모델**은 이후 Coroutine을 이해하는 중요한 기반이 된다.

물론 현대 Python의 `async` / `await` Coroutine을 단순히 Generator와 동일하다고 볼 수는 없다.

하지만

> **실행을 끝내지 않고 중간에 멈추고, 그 실행 상태를 보존한 뒤 나중에 다시 이어간다**

는 아이디어를 Generator에서 먼저 이해해두면 Coroutine의 동작 역시 훨씬 자연스럽게 이해할 수 있다.

---

## 정리

Generator의 전체 흐름을 하나로 연결하면 다음과 같다.

```text
Generator Function
        ↓
      call
        ↓
Generator Object
        ↓
      next()
        ↓
     execution
        ↓
      yield
        ↓
값을 호출자에게 전달
        ↓
execution suspended
        ↓
  실행 상태 보존
        ↓
      next()
        ↓
      resume
        ↓
     execution
        ↓
      yield
        ↓
       ...
        ↓
   함수 실행 종료
        ↓
   StopIteration
```

결국 Generator를 이해하는 핵심은 `yield`라는 문법 자체가 아니다.

```text
Generator
    =
실행 상태를 가진 객체
    +
suspend
    +
resume
    +
Iterator Protocol
```

이다.

앞에서 살펴본 **Frame**이 함수의 실행 상태를 담고 있고, **Iterator**가 `next()`를 통해 값을 하나씩 요청한다는 사실이 여기서 하나로 연결된다.

Generator는 Iterator처럼 `next()`에 응답하지만, 다음 값을 얻기 위해 별도의 상태 머신을 직접 구현하는 대신 **함수의 실행 자체를 멈춰 두었다가 이어서 실행한다.**

그리고 바로 이 지점에서 Python의 실행 모델은 단순한 반복을 넘어 다음 주제인 **Coroutine**으로 이어진다.

---
**다음 글 : 08 Coroutine은 실행을 어떻게 중단하고 재개하는가**
