---
title: "06. Iterator는 반복을 어떻게 가능하게 하는가"

description: "Python의 반복을 가능하게 하는 Iterator Protocol을 살펴보고, Iterable과 Iterator의 차이, iter(), next(), StopIteration, for문의 동작 원리를 이해합니다."

pubDatetime: 2026-09-08T15:34:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Iterator
  - Iterable
  - Iterator Protocol
  - StopIteration

draft: false
---

Python에서 반복문을 작성할 때 가장 익숙한 형태는 `for`문이다.

```python
numbers = [10, 20, 30]

for number in numbers:
    print(number)
```

실행 결과는 단순하다.

```text
10
20
30
```

우리는 보통 이것을

> "`numbers`에서 값을 하나씩 꺼내서 반복한다."

정도로 이해한다.

하지만 여기에는 한 가지 질문이 남는다.

**Python은 `numbers`에서 다음 값을 어떻게 가져오는 걸까?**

리스트 내부의 index를 하나씩 증가시키는 것처럼 보이지만, Python의 `for`문이 모든 객체를 이런 방식으로 처리하는 것은 아니다.

실제로 Python의 반복은 다음과 같은 구조를 기반으로 한다.

```text
Iterable
   ↓
 iter()
   ↓
Iterator
   ↓
 next()
   ↓
 value
   ↓
 next()
   ↓
 value
   ↓
 ...
   ↓
StopIteration
```

그리고 `for`문은 이 과정을 자동으로 수행해주는 문법이다.

이번 글에서는 이 구조를 따라가며 Python에서 **"반복한다"는 것이 실제로 무엇을 의미하는지** 살펴본다.

---

## 1. Iterable은 반복 가능한 객체다

먼저 다음 객체들을 생각해보자.

```python
[1, 2, 3]

("a", "b", "c")

"Python"

{"name": "shin", "age": 20}

range(10)
```

이 객체들은 모두 `for`문에 넣을 수 있다.

```python
for x in [1, 2, 3]:
    print(x)

for x in "Python":
    print(x)
```

이처럼 **반복할 수 있는 객체**를 Python에서는 **Iterable**이라고 한다.

그런데 Iterable이라는 말은 단순히 "`for`문에 넣을 수 있는 객체"라는 의미만 있는 것이 아니다.

Python의 객체 모델에서 조금 더 정확하게 표현하면,

> **`iter()`를 통해 Iterator를 얻을 수 있는 객체**

라고 볼 수 있다.

```python
numbers = [10, 20, 30]

iterator = iter(numbers)
```

여기서 중요한 점이 있다.

```text
List
  ↓
iter()
  ↓
List Iterator
```

`numbers` 자체가 반복을 진행하는 것이 아니라, Python은 `numbers`로부터 **반복을 담당하는 별도의 Iterator를 얻는다.**

---

## 2. Iterable과 Iterator는 다르다

다음 코드를 살펴보자.

```python
numbers = [10, 20, 30]

iterator = iter(numbers)

print(numbers)
print(iterator)
```

개념적으로 두 객체의 역할은 다음과 같다.

```text
numbers
   │
   │ iter()
   ▼
iterator
```

`numbers`는 **어떤 값들이 존재하는지 가지고 있는 객체**이고,

`iterator`는

> **현재 어디까지 읽었으며 다음에 무엇을 반환해야 하는지 알고 있는 객체**

다.

즉 역할이 다르다.

```text
Iterable
"나에게서 반복을 시작할 수 있다."

Iterator
"현재 반복이 어디까지 진행되었는지 기억하고 있다."
```

이 차이는 상당히 중요하다.

예를 들어 같은 리스트에서 두 개의 Iterator를 만들 수 있다.

```python
numbers = [10, 20, 30]

a = iter(numbers)
b = iter(numbers)
```

그러면 `a`와 `b`는 서로 독립적으로 반복 상태를 가진다.

```python
next(a)  # 10
next(a)  # 20

next(b)  # 10
```

구조적으로 보면 다음과 같다.

```text
              ┌──→ Iterator A
              │      position = 2
              │
[10, 20, 30] ─┤
              │
              └──→ Iterator B
                     position = 1
```

원본 리스트가 현재 위치를 기억하는 것이 아니다.

**Iterator가 반복의 진행 상태를 기억한다.**

---

## 3. `iter()`는 Iterator를 얻는다

그렇다면 Python은 어떻게 Iterable에서 Iterator를 가져올까?

바로 내장 함수 `iter()`를 사용한다.

```python
numbers = [10, 20, 30]

iterator = iter(numbers)
```

객체 모델의 관점에서는 이것을 대략 다음과 연결해서 이해할 수 있다.

```python
iter(numbers)
```

↓

```python
numbers.__iter__()
```

즉 Iterable 객체는 일반적으로 `__iter__()`를 통해 Iterator를 제공한다.

직접 간단한 Iterable을 만들어볼 수도 있다.

```python
class Numbers:
    def __iter__(self):
        return iter([10, 20, 30])
```

그러면 다음이 가능하다.

```python
numbers = Numbers()

for number in numbers:
    print(number)
```

`for`문이 `Numbers`라는 클래스를 특별히 알고 있는 것은 아니다.

단지 이 객체에서 **Iterator를 얻을 수 있기 때문에 반복할 수 있는 것**이다.

이것이 Python의 Iterator Protocol이 제공하는 중요한 추상화다.

---

## 4. `next()`는 다음 값을 요청한다

Iterator를 얻었다면 이제 값을 하나씩 가져올 수 있다.

```python
numbers = [10, 20, 30]

iterator = iter(numbers)

print(next(iterator))
print(next(iterator))
print(next(iterator))
```

결과는 다음과 같다.

```text
10
20
30
```

여기서 `next()`는 Iterator에게 묻는 것과 비슷하다.

```text
"다음 값 줘."
```

Iterator는 자신의 현재 상태를 확인하고 다음 값을 반환한다.

```text
Iterator
position = 0

next()
   ↓
10
position = 1

next()
   ↓
20
position = 2

next()
   ↓
30
position = 3
```

객체 모델의 관점에서는

```python
next(iterator)
```

가 Iterator의

```python
iterator.__next__()
```

와 연결된다.

따라서 Iterator의 핵심은 크게 두 가지다.

```python
__iter__()
__next__()
```

특히 `__next__()`가 **다음 값을 반환하면서 반복 상태를 앞으로 진행시킨다.**

---

## 5. 그런데 마지막 값 다음에는 무엇을 반환할까?

문제가 하나 있다.

```python
numbers = [10, 20, 30]

iterator = iter(numbers)

next(iterator)  # 10
next(iterator)  # 20
next(iterator)  # 30
next(iterator)  # ?
```

더 이상 반환할 값이 없다.

그렇다면 Python은 무엇을 반환해야 할까?

`None`을 반환하면 될 것 같지만 그렇게 할 수 없다.

왜냐하면 `None` 역시 정상적인 데이터가 될 수 있기 때문이다.

```python
values = [1, None, 3]
```

따라서 Python은 **값이 없다는 것을 특별한 반환값으로 표현하지 않는다.**

대신 예외를 발생시킨다.

```text
StopIteration
```

실제로 다음 코드를 실행하면

```python
iterator = iter([10, 20, 30])

next(iterator)
next(iterator)
next(iterator)
next(iterator)
```

마지막 `next()`에서 `StopIteration`이 발생한다.

즉 Iterator Protocol은 다음과 같은 규칙을 가진다.

```text
next(iterator)

값이 남아 있다
    ↓
값 반환

값이 없다
    ↓
StopIteration 발생
```

`StopIteration`은 단순한 오류라기보다,

> **"반복이 정상적으로 끝났다"**

라는 신호에 가깝다.

---

## 6. 직접 Iterator를 만들어보자

이제 Iterator의 동작을 직접 구현해보면 구조가 훨씬 명확해진다.

```python
class CountIterator:
    def __init__(self, end):
        self.current = 0
        self.end = end

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.end:
            raise StopIteration

        value = self.current
        self.current += 1

        return value
```

사용해보자.

```python
iterator = CountIterator(3)

print(next(iterator))
print(next(iterator))
print(next(iterator))
```

결과는

```text
0
1
2
```

이다.

한 번 더 호출하면

```python
next(iterator)
```

`StopIteration`이 발생한다.

이 객체 내부에서 가장 중요한 값은

```python
self.current
```

이다.

Iterator가 **현재 반복이 어디까지 진행되었는지 직접 기억하고 있기 때문이다.**

```text
CountIterator

current = 0
    ↓ next()
current = 1
    ↓ next()
current = 2
    ↓ next()
current = 3
    ↓ next()
StopIteration
```

결국 Iterator는 단순히 값을 저장하는 객체가 아니다.

**반복의 실행 상태를 가진 객체다.**

---

## 7. `for`문은 Iterator Protocol을 자동으로 사용한다

이제 처음의 코드로 돌아가보자.

```python
numbers = [10, 20, 30]

for number in numbers:
    print(number)
```

겉으로는 매우 간단하지만 Python은 개념적으로 다음과 비슷한 작업을 수행한다.

```python
iterator = iter(numbers)

while True:
    try:
        number = next(iterator)
    except StopIteration:
        break

    print(number)
```

즉 `for`문은 완전히 새로운 반복 시스템이 아니다.

이미 존재하는

```text
iter()
next()
StopIteration
```

이라는 Iterator Protocol을 편하게 사용할 수 있도록 감싸주는 문법이다.

전체 흐름을 그려보면 다음과 같다.

```text
for x in iterable
        │
        ▼
  iter(iterable)
        │
        ▼
     Iterator
        │
        ▼
 next(iterator)
        │
    ┌───┴──────────┐
    │              │
 value       StopIteration
    │              │
    ▼              ▼
 loop body        종료
    │
    └──────→ next()
```

따라서

```python
for x in numbers:
```

를 이해한다는 것은 사실

> **Python이 Iterator를 만들고 `next()`를 반복해서 호출하다가 `StopIteration`을 만나면 반복을 종료한다.**

는 구조를 이해하는 것이다.

---

## 8. 왜 Iterable과 Iterator를 분리했을까?

여기서 중요한 설계상의 질문이 생긴다.

**왜 그냥 List가 현재 index를 기억하면 안 될까?**

예를 들어 리스트가 직접 현재 위치를 저장한다고 생각해보자.

```text
List

data = [10, 20, 30]
current = 2
```

그러면 하나의 리스트를 동시에 여러 곳에서 반복하기 어려워진다.

```python
numbers = [10, 20, 30]

for a in numbers:
    for b in numbers:
        ...
```

각 반복은 서로 다른 진행 상태를 가져야 한다.

그래서 Python은 **데이터를 제공하는 객체와 반복 상태를 관리하는 객체를 분리할 수 있도록 설계되어 있다.**

```text
                Iterable
             [10, 20, 30]
              /         \
             /           \
         iter()         iter()
           ↓              ↓
      Iterator A      Iterator B
      position=1      position=2
```

덕분에 동일한 Iterable을 대상으로 여러 개의 독립적인 반복을 수행할 수 있다.

그리고 이 구조는 리스트뿐 아니라 파일, 문자열, 딕셔너리, `range`, generator 등 서로 전혀 다른 객체들을 **동일한 반복 인터페이스로 다룰 수 있게 한다.**

```python
for x in list:
    ...

for x in tuple:
    ...

for x in file:
    ...

for x in range(...):
    ...

for x in generator:
    ...
```

`for`문은 이 객체들의 내부 구현을 알 필요가 없다.

단지

```text
Iterator를 얻을 수 있는가?
        ↓
next()로 값을 받을 수 있는가?
```

만 알면 된다.

---

## 9. Iterator는 "다음 값을 계산하는 방법"이기도 하다

Iterator를 단순히 **collection에서 값을 하나씩 꺼내는 장치**라고 생각하면 중요한 부분을 놓칠 수 있다.

Iterator는 반드시 모든 데이터를 미리 가지고 있을 필요가 없다.

예를 들어 이런 Iterator도 만들 수 있다.

```python
class Counter:
    def __init__(self):
        self.current = 0

    def __iter__(self):
        return self

    def __next__(self):
        value = self.current
        self.current += 1
        return value
```

이 Iterator에는 끝이 없다.

```python
counter = Counter()

next(counter)  # 0
next(counter)  # 1
next(counter)  # 2
next(counter)  # 3
```

어딘가에

```python
[0, 1, 2, 3, ...]
```

이라는 거대한 리스트가 존재하는 것이 아니다.

필요할 때마다 다음 값을 계산한다.

```text
state = 0
   ↓ next()
0

state = 1
   ↓ next()
1

state = 2
   ↓ next()
2
```

즉 Iterator는

> **모든 결과를 저장하는 대신 현재 상태와 다음 값을 만드는 방법만 가지고 있을 수 있다.**

이 특성은 메모리 효율적인 데이터 처리에서 매우 중요하다.

그리고 바로 이 지점에서 Python의 **Generator**가 등장한다.

---

## 10. Iterator의 핵심은 "상태를 기억하면서 실행을 이어간다"는 것이다

앞선 글에서 Python의 실행 상태를 Frame을 통해 살펴봤다.

함수를 호출하면 Frame이 만들어지고 그 안에는 지역 변수, operand stack, 현재 실행 위치 등 함수 실행에 필요한 상태가 존재한다.

그런데 일반적인 함수는 `return`을 만나면 실행을 종료한다.

```python
def func():
    x = 10
    return x
```

개념적으로 보면

```text
Function Call
     ↓
   Frame
     ↓
 execution
     ↓
   return
     ↓
   종료
```

이다.

반면 Iterator에서 중요한 것은

```text
현재 상태
   ↓
다음 값 반환
   ↓
현재 상태 유지
   ↓
다음 요청
```

이라는 구조다.

이 아이디어를 Python의 함수 실행 모델과 결합하면 매우 흥미로운 형태가 만들어진다.

**함수가 값을 하나 반환하면서도 실행 상태를 버리지 않고, 다음 호출에서 이전 위치부터 다시 실행할 수 있다면 어떨까?**

바로 이것이 다음에 살펴볼 **Generator**의 핵심이다.

---

## 11. 정리

Python의 반복은 단순히 collection의 index를 증가시키는 방식으로 정의되어 있지 않다.

핵심에는 **Iterator Protocol**이 있다.

```text
Iterable
   ↓
 iter()
   ↓
Iterator
   ↓
 next()
   ↓
value
   ↓
 next()
   ↓
  ...
   ↓
StopIteration
```

그리고 `for`문은 이 과정을 자동으로 처리한다.

각 개념의 역할을 정리하면 다음과 같다.

```text
Iterable
→ Iterator를 만들 수 있는 객체

Iterator
→ 반복의 현재 상태를 기억하는 객체

iter()
→ Iterable에서 Iterator를 얻는다

next()
→ Iterator에게 다음 값을 요청한다

StopIteration
→ 더 이상 값이 없음을 알린다

for
→ 위 과정을 자동으로 반복한다
```

결국 Python에서 **반복한다**는 것은

> **Iterator에게 계속해서 다음 값을 요청하고, `StopIteration`이 발생할 때까지 실행을 이어가는 것**

이라고 볼 수 있다.

그리고 여기서 한 단계 더 나아가면 새로운 질문이 생긴다.

**Iterator의 상태를 객체에 직접 구현하지 않고, 함수의 실행 상태 자체를 멈췄다가 다시 이어갈 수는 없을까?**

Python은 이를 위해 `yield`와 **Generator**라는 실행 모델을 제공한다.

```text
Iterator
    ↓
상태를 기억하며 next()
    ↓
Generator
    ↓
함수 실행을 suspend / resume
    ↓
yield
```

다음 글에서는 **Generator가 함수의 실행을 어떻게 멈추고 다시 이어가는지**, 그리고 이것이 이후 Coroutine으로 어떻게 확장되는지를 살펴본다.

---
**다음 글 : 07 Generator는 실행을 어떻게 멈췄다가 다시 시작하는가**