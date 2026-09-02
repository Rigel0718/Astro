---
title: "06. Attribute를 읽으면 내부에서 어떤 일이 일어나는가"
description: "Python에서 obj.x를 읽을 때 Attribute가 어떤 순서로 탐색되는지 살펴보고, __getattribute__, Descriptor Protocol, Data Descriptor와 Non-data Descriptor, Method Binding을 통해 Attribute 접근의 내부 동작을 이해합니다."
pubDatetime: 2026-09-02T23:35:00+09:00
tags:
  - Python
  - 파이썬 객체에 대한 이해
  - Attribute Lookup
  - Descriptor
draft: false
---

앞선 글에서는 Python의 Attribute가 주로 어디에 저장되는지 살펴봤다.

일반적인 객체라면 instance의 Attribute는 `instance.__dict__`에 저장되고, class에 정의한 Attribute는 `class.__dict__`에 저장된다.

```python
class Person:
    species = "human"

    def __init__(self, name):
        self.name = name


p = Person("shin")
```

대략적으로 보면 다음과 같다.

```python
p.__dict__
# {'name': 'shin'}

Person.__dict__
# {
#     'species': 'human',
#     '__init__': <function ...>,
#     ...
# }
```

그렇다면 이제 이런 질문이 생긴다.

```python
p.name
p.species
```

Python은 `p.name`을 읽었을 때 어떻게 `p.__dict__`를 찾아가고, `p.species`를 읽었을 때는 어떻게 `Person.__dict__`까지 찾아가는 것일까?

겉으로 보면 단순히 `"name"`이라는 값을 꺼내오는 것처럼 보이지만, 실제 Attribute 접근은 생각보다 훨씬 많은 규칙을 따른다.

특히 Python에서는 method, `property`, `classmethod` 같은 기능도 이 Attribute 탐색 과정 위에 만들어져 있다.

즉,

> **`obj.x`는 단순한 dictionary lookup이 아니다.**

---

## 1. `obj.x`를 읽으면 가장 먼저 무슨 일이 일어날까?

다음 코드가 있다고 해보자.

```python
class Person:
    def __init__(self):
        self.name = "shin"


p = Person()

print(p.name)
```

우리는 보통 이것을 다음과 같이 생각한다.

```text
p
│
▼
p.__dict__
│
▼
"name" 탐색
│
▼
"shin"
```

결과적으로는 비슷한 일이 일어날 수 있지만, Python의 실제 출발점은 조금 다르다.

```python
p.name
```

이라는 표현은 개념적으로 다음과 비슷하다.

```python
object.__getattribute__(p, "name")
```

즉 Python에서 대부분의 Attribute 접근은 먼저

```python
__getattribute__()
```

라는 특별한 메서드를 통과한다.

그래서 다음과 같은 코드도 가능하다.

```python
class Person:
    def __getattribute__(self, name):
        print("attribute 접근:", name)
        return object.__getattribute__(self, name)


p = Person()
p.name
```

`p.name`을 읽는 순간 `__getattribute__()`가 호출된다.

다만 우리가 평소 만드는 대부분의 class는 직접 `__getattribute__()`를 구현하지 않는다.

대신 기본적으로 `object`가 제공하는 Attribute 탐색 로직을 사용한다.

따라서

```python
obj.x
```

를 이해한다는 것은 사실상

> **`object.__getattribute__()`가 `"x"`를 어떤 규칙으로 해석하는가**

를 이해하는 것과 가깝다.

---

## 2. 단순히 instance부터 찾는 것은 아니다

Attribute 탐색을 처음 배울 때는 흔히 다음과 같이 설명한다.

```text
instance
    ↓
class
    ↓
parent class
```

예를 들어

```python
class Person:
    species = "human"


p = Person()
p.name = "shin"
```

이라면

```python
p.name
```

은 instance에서 찾고,

```python
p.species
```

는 instance에 없으므로 class에서 찾는다는 식이다.

입문 단계에서는 꽤 유용한 설명이다.

하지만 Python의 실제 Attribute 탐색을 이해하기에는 한 가지 중요한 요소가 빠져 있다.

바로 **Descriptor**다.

Descriptor 때문에 어떤 class attribute는 instance attribute보다 먼저 선택될 수도 있고, 어떤 class attribute는 반대로 instance attribute에 가려질 수도 있다.

따라서 실제 탐색 순서를 이해하기 전에 먼저 Descriptor가 무엇인지 알아야 한다.

---
## 3. Descriptor란 무엇인가?

먼저 **Descriptor라는 말이 무엇을 가리키는지**부터 명확히 할 필요가 있다.

**Descriptor 란?**

 `__get__()`, `__set__()`, `__delete__()` 같은 **Descriptor Protocol의 메서드를 정의한 객체를 Descriptor라고 한다.**

Descriptor라는 별도의 특정 class가 존재해서 이를 상속해야 하는 것은 아니다.

어떤 객체가 Descriptor Protocol을 구현하고 있다면 Python은 그 객체를 **Descriptor**로 취급한다.

대표적인 Descriptor Protocol의 메서드는 다음과 같다.

```python
__get__()
__set__()
__delete__()
```

각 메서드는 Attribute 접근의 서로 다른 동작에 대응한다.

```text
__get__()     → Attribute 읽기에 개입
__set__()     → Attribute 쓰기에 개입
__delete__()  → Attribute 삭제에 개입
```

따라서 **Descriptor**와 **Descriptor Protocol**은 구분해서 생각해야 한다.

```text
Descriptor Protocol
        │
        │ Python이 정한 규칙
        │
        ├── __get__()
        ├── __set__()
        └── __delete__()
        │
        │ 이 Protocol을 구현
        ▼
Descriptor
        │
        └── 실제 객체
```

즉,

```text
Descriptor          = Protocol을 구현한 객체
Descriptor Protocol = Python과 객체 사이의 Attribute 접근 규칙
```

이라고 생각할 수 있다.

그렇다면 Descriptor 객체는 무엇이 특별할까?

단순히 `__get__()`이라는 이름의 메서드를 가지고 있다는 것만으로는 Descriptor의 특징이 잘 드러나지 않는다.

핵심은 다음과 같다.

> **Python의 Attribute 접근 시스템이 Descriptor를 발견하면 이러한 메서드를 상황에 맞게 호출해 준다.**

평범한 객체와 비교해보자.

```python
class Age:
    def read(self):
        return 20


age = Age()
```

`age` 객체가 `read()`라는 메서드를 가지고 있다고 해서

```python
age
```

라고 접근했을 때 `read()`가 자동으로 실행되지는 않는다.

직접 호출해야 한다.

```python
age.read()
```

즉 일반적인 메서드는

```text
age.read()
    │
    ▼
개발자가 직접 호출
    │
    ▼
read() 실행
```

이라는 구조다.

Descriptor는 다르다.

```python
class Age:
    def __get__(self, instance, owner):
        print("age를 읽었습니다.")
        return 20


class Person:
    age = Age()
```

여기서 `Age()`로 생성된 객체는 `Age`의 instance인 동시에 `__get__()`을 정의하고 있으므로 **Descriptor 객체**다.

그리고 이 객체는 `Person`의 class attribute인 `age`에 저장되어 있다.

```text
Person.__dict__

"age"
  │
  ▼
Age instance
  │
  ├── Age의 객체
  │
  └── Descriptor
       └── __get__() 지원
```

따라서 현재 `Person.__dict__`의 `"age"`에 숫자 `20`이 들어 있는 것은 아니다.

실제로

```python
Person.__dict__["age"]
```

를 확인하면 `Age` 객체가 들어 있다.

그런데 다음과 같이 Attribute에 접근해보자.

```python
p = Person()

p.age
```

우리는 어디에서도 직접

```python
Person.__dict__["age"].__get__(p, Person)
```

을 호출하지 않았다.

그럼에도 Python의 Attribute 접근 시스템은 class 쪽에서 `age`를 탐색하는 과정에서 `Age` 객체를 발견하고, 이 객체가 Descriptor라는 것을 확인하면 `__get__()`을 호출할 수 있다.

```text
p.age
  │
  ▼
Attribute 탐색
  │
  ▼
Person 쪽에서 "age" 발견
  │
  ▼
Age instance
  │
  ▼
Descriptor인가?
(__get__ 지원?)
  │
  ├── YES ──→ __get__(p, Person)
  │                 │
  │                 ▼
  │              return 20
  │                 │
  │                 ▼
  │                 20
  │
  └── NO ──→ 일반적인 class attribute로 처리
```

따라서

```python
print(p.age)
```

는 최종적으로 다음을 출력한다.

```text
age를 읽었습니다.
20
```

여기서 Descriptor를 이해할 때 한 가지를 더 구분해야 한다.

**Python이 결정하는 것**과 **Descriptor 객체가 결정하는 것**은 서로 다르다.

Python은 Attribute 접근 과정에서 Descriptor를 발견했을 때

> **언제 `__get__()`, `__set__()`, `__delete__()` 같은 메서드를 호출할 것인가**

를 결정한다.

반면 실제로 메서드가 호출된 뒤

> **그 메서드가 무엇을 할 것인가**

는 각각의 Descriptor 구현에 달려 있다.

우리가 만든 `Age` Descriptor는

```python
def __get__(self, instance, owner):
    print("age를 읽었습니다.")
    return 20
```

이라고 구현했기 때문에 메시지를 출력하고 `20`을 반환한다.

하지만 다른 Descriptor의 `__get__()`은 전혀 다른 동작을 할 수 있다.

이를 정리하면 다음과 같다.

```text
Python
  │
  │ Descriptor Protocol에 따라
  │ "언제 호출할 것인가"를 결정
  ▼
__get__() 호출
  │
  │ Descriptor마다 구현이 다름
  │ "무엇을 할 것인가"를 결정
  ▼
결과
```

즉 **Descriptor Protocol은 Python의 Attribute 접근 시스템과 Descriptor 객체 사이의 약속**이다.

그리고 그 약속을 구현하여 Attribute 접근에 개입하는 **실제 객체가 Descriptor**다.

```text
Descriptor Protocol
        │
        │ Attribute 접근에 관한 약속
        ▼
Python Attribute 시스템
        │
        │ 상황에 맞는 메서드 호출
        ▼
Descriptor 객체
        │
        ├── __get__()
        ├── __set__()
        └── __delete__()
        │
        ▼
각 Descriptor가 정의한 동작
```

따라서 Descriptor의 핵심은 단순히 특별한 이름의 메서드를 가진 객체라는 데 있지 않다.

> **Descriptor는 Descriptor Protocol을 구현한 객체이며, Python의 Attribute 접근 시스템이 이 Protocol에 따라 Descriptor의 메서드를 자동으로 호출한다.**

이 구조를 이해하면 이후 `property`, method, `classmethod`, `staticmethod` 등이 Attribute 접근 과정에서 특별하게 동작하는 이유도 같은 원리로 이해할 수 있다.

---

## 4. Descriptor에는 두 종류가 있다

여기서 Attribute 탐색 순서를 이해하기 위해 반드시 알아야 하는 구분이 있다.

Descriptor는 크게 **Data Descriptor**와 **Non-data Descriptor**로 나뉜다.

### Data Descriptor

`__set__()` 또는 `__delete__()`를 제공하는 Descriptor를 Data Descriptor라고 한다.

보통 읽기까지 제어하는 경우 다음과 같은 모습이 된다.

```python
class Age:
    def __get__(self, instance, owner):
        return 20

    def __set__(self, instance, value):
        print("age 설정:", value)
```

이 `Age`는 Data Descriptor다.

핵심은 Data Descriptor가 **Attribute를 읽는 것뿐 아니라 설정하거나 삭제하는 과정에도 개입할 수 있다는 것**이다.

### Non-data Descriptor

`__get__()`만 제공하고 `__set__()`이나 `__delete__()`를 제공하지 않는 Descriptor는 Non-data Descriptor다.

```python
class Age:
    def __get__(self, instance, owner):
        return 20
```

이 `Age`는 Non-data Descriptor다.

이 둘을 굳이 구분하는 이유는 단순한 분류를 위해서가 아니다.

> **instance attribute와 class 쪽 Descriptor가 같은 이름을 가지고 있을 때 우선순위가 달라지기 때문이다.**


---

## 5. 실제 Attribute 탐색은 어떤 순서로 이루어질까?

일반적인 instance의

```python
obj.x
```

접근을 단순화하면 다음과 같이 생각할 수 있다.

```text
obj.x
 │
 ▼
obj.__getattribute__("x")
 │
 ▼
class 쪽에서 "x" 탐색
 │
 ▼
"x"를 찾았는가?
 │
 ├── YES
 │    │
 │    ▼
 │   Data Descriptor인가?
 │    │
 │    ├── YES ───────────────→ descriptor.__get__()
 │    │                              │
 │    │                              ▼
 │    │                           결과 반환
 │    │
 │    └── NO
 │         │
 │    ┌────┘
 │    │
 ▼    ▼
obj.__dict__에 "x"가 있는가?
 │
 ├── YES ────────────────────→ instance attribute 반환
 │
 └── NO
      │
      ▼
class 쪽에서 찾았던 "x"가 있는가?
      │
      ├── YES
      │    │
      │    ▼
      │   Descriptor인가?
      │    │
      │    ├── YES ──────────→ descriptor.__get__()
      │    │
      │    └── NO ───────────→ class attribute 그대로 반환
      │
      └── NO
           │
           ▼
      __getattr__이 있는가?
           │
           ├── YES ──────────→ __getattr__("x")
           │
           └── NO ───────────→ AttributeError
```

여기서 처음 보면 이상한 부분이 하나 있다.

Python은 instance의 `__dict__`를 보기 전에 먼저 class 쪽을 확인한다.

하지만 class에서 Attribute를 발견했다고 해서 무조건 그 값을 반환하는 것은 아니다.

먼저

```text
이것이 Data Descriptor인가?
```

를 확인하기 위한 것이다.

Data Descriptor라면 즉시 사용한다.

그렇지 않다면 다시 instance `__dict__`를 확인한다.

따라서 핵심적인 우선순위만 뽑으면 다음과 같다.

```text
1. class / MRO의 Data Descriptor
              ↓
2. instance.__dict__
              ↓
3. class / MRO의 Non-data Descriptor
   또는 일반 class attribute
              ↓
4. __getattr__
              ↓
5. AttributeError
```

즉 우리가 흔히 배우는

```text
instance → class
```

는 완전히 틀린 설명은 아니지만 실제로는

```text
class의 Data Descriptor
        ↓
instance attribute
        ↓
나머지 class attribute
```

라는 중요한 예외가 존재한다.

---

## 6. Data Descriptor는 instance attribute보다 강하다

이제 왜 class 쪽을 먼저 확인해야 하는지 실제 코드로 살펴보자.

```python
class Age:
    def __get__(self, instance, owner):
        return 20

    def __set__(self, instance, value):
        instance.__dict__["age"] = value


class Person:
    age = Age()
```

`Age`는 `__get__()`과 `__set__()`을 지원하므로 Data Descriptor다.

이제 instance dictionary에 같은 이름을 직접 만들어보자.

```python
p = Person()

p.__dict__["age"] = 30
```

현재 구조는 다음과 같다.

```text
p.__dict__
└── "age" → 30


Person.__dict__
└── "age" → Age instance
             │
             ├── __get__
             └── __set__

             Data Descriptor
```

이 상태에서

```python
p.age
```

를 실행하면 무엇이 나올까?

instance에 `"age": 30`이 있으므로 `30`이 나올 것 같지만 실제 결과는

```python
20
```

이다.

탐색 과정을 따라가 보면 이유를 알 수 있다.

```text
p.age
 │
 ▼
Person 쪽에서 "age" 발견
 │
 ▼
Age instance
 │
 ▼
Data Descriptor인가?
 │
 ├── YES
 │
 ▼
Age.__get__(p, Person)
 │
 ▼
20
```

`p.__dict__["age"]`를 확인하는 단계까지 내려가지 않는다.

따라서

> **Data Descriptor > instance attribute**

라는 우선순위가 성립한다.

이것이 class attribute가 instance attribute보다 먼저 선택될 수 있는 대표적인 경우다.

---

## 7. Non-data Descriptor는 instance attribute에 밀린다

이번에는 `__set__()`을 없애보자.

```python
class Age:
    def __get__(self, instance, owner):
        return 20


class Person:
    age = Age()
```

이번 `Age`는 `__get__()`만 지원하므로 Non-data Descriptor다.

마찬가지로

```python
p = Person()
p.__dict__["age"] = 30
```

이라고 해보자.

구조는 다음과 같다.

```text
p.__dict__
└── "age" → 30


Person.__dict__
└── "age" → Age instance
             │
             └── __get__

             Non-data Descriptor
```

이제

```python
p.age
```

를 읽으면 결과는

```python
30
```

이다.

탐색 과정은 다음과 같다.

```text
p.age
 │
 ▼
Person 쪽에서 "age" 발견
 │
 ▼
Data Descriptor인가?
 │
 └── NO
      │
      ▼
p.__dict__에 "age"가 있는가?
      │
      ├── YES
      │
      ▼
      30 반환
```

class 쪽에 Descriptor가 존재하기는 하지만 **Data Descriptor가 아니기 때문에** instance attribute가 먼저 선택된다.

따라서

> **instance attribute > Non-data Descriptor**

가 된다.

두 경우를 나란히 놓으면 차이가 명확하다.

```text
Data Descriptor

class descriptor
      ↓
instance attribute


Non-data Descriptor

instance attribute
      ↓
class descriptor
```

이 우선순위가 Python Attribute 탐색을 이해하는 핵심이다.

---

## 8. Descriptor의 `__get__()`은 모두 같은 일을 하는가?

그렇지 않다.

Descriptor Protocol은 `__get__()` 내부에서 무엇을 해야 하는지 정해놓은 규칙이 아니다.

Python이 정한 것은

```text
Attribute 탐색 중 Descriptor를 발견
              ↓
필요한 경우 __get__() 호출
```

이라는 약속이다.

그 이후 무엇을 반환할지는 각각의 Descriptor가 결정한다.

예를 들어 우리가 만든 `Age` Descriptor는

```python
class Age:
    def __get__(self, instance, owner):
        return 20
```

이라고 구현했으므로

```text
p.age
  ↓
Age.__get__()
  ↓
20
```

을 반환한다.

하지만 Python의 `function` 객체도 Descriptor Protocol을 지원한다.

function의 `__get__()`은 `20` 같은 값을 반환하기 위한 것이 아니다.

특정 instance와 function을 연결하는 역할을 한다.

`property` 역시 Descriptor이지만 `__get__()`에서 property의 getter를 실행하도록 동작한다.

즉 같은 `__get__()`이라는 프로토콜을 사용하더라도 실제 행동은 다르다.

```text
                Descriptor Protocol
                       │
                       │ __get__()
             ┌─────────┼─────────┐
             │         │         │
             ▼         ▼         ▼
           Age      function   property
             │         │         │
             ▼         ▼         ▼
          20 반환    method     getter
                    binding      실행
```

Python은 **언제 `__get__()`을 호출할지**를 결정하고,

각 Descriptor는 **호출되었을 때 무엇을 할지**를 결정한다.

---

## 9. Python의 method도 Descriptor 위에서 만들어진다

Descriptor가 중요한 이유는 사용자가 특이한 Attribute를 만들 수 있기 때문만은 아니다.

Python 자체의 핵심 기능들도 Descriptor Protocol을 사용한다.

대표적인 것이 **method**다.

```python
class Person:
    def hello(self):
        print("hello")
```

class 안에 `hello()`를 정의했다고 해서 `Person` 안에 특별한 method 저장 공간이 생기는 것은 아니다.

실제로

```python
Person.__dict__["hello"]
```

에는 **function 객체**가 저장되어 있다.

```text
Person.__dict__

"hello"
   │
   ▼
function object
```

그래서

```python
Person.hello
```

를 가져오면 function 객체를 얻는다.

```python
print(Person.hello)
# <function Person.hello at ...>
```

그리고 function을 직접 호출한다면 `self`에 들어갈 객체를 직접 전달해야 한다.

```python
p = Person()

Person.hello(p)
```

반면 우리가 평소에는 다음과 같이 사용한다.

```python
p.hello()
```

여기에는 한 가지 의문이 있다.

`hello()`는 분명 첫 번째 인자를 요구한다.

```python
def hello(self):
          ↑
       인자 필요
```

그런데

```python
p.hello()
```

에서는 아무 인자도 직접 전달하지 않았다.

이것이 가능한 이유가 **function 객체 자체가 Descriptor이기 때문**이다.

우리가 function에 직접 `__get__()`을 작성한 것은 아니다.

Python의 내장 `function` 타입 자체가 이미 Descriptor Protocol을 지원한다.

개념적으로는 다음과 같이 생각할 수 있다.

```text
p.hello
   │
   ▼
Person 쪽에서 "hello" 탐색
   │
   ▼
function object 발견
   │
   ▼
function은 Descriptor
   │
   ▼
function의 __get__ 동작
   │
   ▼
Person.hello + p를 묶음
   │
   ▼
Bound Method
```

Bound Method는 어렵게 생각할 필요가 없다.

> **호출할 function과 그 function에 전달할 특정 instance를 묶어놓은 객체**

라고 생각하면 된다.

```text
┌───────────────────────────┐
│ Bound Method              │
│                           │
│ function ──→ Person.hello │
│ instance ──→ p            │
└───────────────────────────┘
```

그래서

```python
p.hello()
```

를 호출하면 bound method에 이미 연결되어 있던 `p`가 첫 번째 인자로 전달된다.

개념적으로는

```python
Person.hello(p)
```

와 비슷한 호출이 되는 것이다.

여기서 `self`라는 이름 자체가 특별한 것은 아니다.

```python
class Person:
    def hello(abc):
        print(abc)
```

라고 작성해도

```python
p.hello()
```

는 정상적으로 동작한다.

`abc`에 `p`가 전달된다.

즉

```text
self가 있어서 Bound Method가 된다
```

가 아니라,

```text
class에 function 저장
        ↓
function이 Descriptor Protocol 지원
        ↓
p.hello로 접근
        ↓
function의 descriptor 동작
        ↓
function + p가 묶임
        ↓
Bound Method
        ↓
호출할 때 p가 첫 번째 인자로 전달
```

되는 것이다.

그리고 일반적인 Python function은 **Non-data Descriptor**다.

이 사실은 앞에서 살펴본 Attribute 우선순위와도 연결된다.

---

## 10. 그래서 method도 instance attribute로 가릴 수 있다

일반적인 function은 Non-data Descriptor이므로 instance attribute보다 우선순위가 낮다.

다음 class가 있다고 해보자.

```python
class Person:
    def hello(self):
        print("hello")
```

평소에는

```python
p = Person()

p.hello()
```

가 잘 동작한다.

하지만 instance에 같은 이름의 Attribute를 만들면 어떻게 될까?

```python
p.hello = "not a method"
```

현재 구조는 다음과 같다.

```text
p.__dict__
└── "hello" → "not a method"


Person.__dict__
└── "hello" → function object
               │
               └── Non-data Descriptor
```

이제

```python
p.hello
```

를 읽는다.

탐색 순서를 따라가면

```text
p.hello
 │
 ▼
Person에서 "hello" 발견
 │
 ▼
Data Descriptor인가?
 │
 └── NO
      │
      ▼
p.__dict__에 "hello"가 있는가?
      │
      ├── YES
      │
      ▼
"not a method"
```

가 된다.

따라서 더 이상 function의 Descriptor 동작까지 도달하지 않는다.

그래서

```python
p.hello()
```

를 실행하면 문자열을 함수처럼 호출하게 되어

```text
TypeError: 'str' object is not callable
```

같은 오류가 발생할 수 있다.

이것은 우연한 현상이 아니라

> **Non-data Descriptor < instance attribute**

라는 Attribute 탐색 규칙의 직접적인 결과다.

---

## 11. `property`는 왜 instance attribute보다 강할까?

`property` 역시 Descriptor Protocol을 사용하는 대표적인 기능이다.

```python
class Person:
    @property
    def name(self):
        return "shin"
```

여기서

```python
Person.__dict__["name"]
```

에는 function이 아니라 `property` 객체가 저장된다.

```text
Person.__dict__

"name"
   │
   ▼
property object
```

`property`는 Data Descriptor로 동작하기 때문에 instance dictionary보다 우선한다.

따라서 다음과 같이 직접 같은 이름을 넣어도

```python
p = Person()

p.__dict__["name"] = "kim"
```

```text
p.__dict__
└── "name" → "kim"


Person.__dict__
└── "name" → property
              │
              └── Data Descriptor
```

`p.name`의 결과는 `"kim"`이 아니다.

```python
print(p.name)
# shin
```

탐색 과정에서 class 쪽의 `property`가 Data Descriptor로 먼저 선택되기 때문이다.

```text
p.name
 │
 ▼
Person에서 "name" 발견
 │
 ▼
property object
 │
 ▼
Data Descriptor인가?
 │
 ├── YES
 │
 ▼
property의 __get__ 동작
 │
 ▼
getter 실행
 │
 ▼
"shin"
```

즉 `@property`는 단순히 함수를 예쁘게 호출하기 위한 문법 장식이 아니다.

Attribute 접근 과정에 개입하는 Descriptor 객체를 만드는 기능이다.

---

## 12. class에서 Attribute를 찾는다는 것은 현재 class만 본다는 뜻이 아니다

지금까지는 설명을 단순하게 하기 위해 `Person` class만 표시했다.

하지만 실제로 class 쪽에서 Attribute를 탐색할 때는 상속 관계도 고려된다.

```python
class Animal:
    species = "animal"


class Person(Animal):
    pass


p = Person()
```

다음 Attribute를 읽어보자.

```python
p.species
```

`Person.__dict__`에는 `"species"`가 없다.

그러면 Python은 상속 계층까지 탐색한다.

```text
p
│
▼
Person
│
▼
Animal
│
▼
"species" 발견
```

하지만 상속이 여러 단계이고 다중 상속까지 들어가면 단순히

```text
현재 class → 부모 class
```

정도로 설명하기 어려워진다.

Python은 class의

```python
__mro__
```

에 정의된 순서를 기준으로 Attribute를 탐색한다.

```python
Person.__mro__
```

를 통해 이 순서를 확인할 수 있다.

이 부분은 다음 글인

> **07. 상속하면 Attribute를 어디서 찾아오는가?**

에서 자세히 살펴본다.

현재 글에서는 class 쪽 탐색을 볼 때

```text
class / MRO에서 탐색
```

정도로 이해하면 충분하다.

---

## 13. Attribute를 끝까지 못 찾으면 `__getattr__()`가 등장한다

`__getattribute__()`와 이름이 비슷한 또 하나의 특별한 메서드가 있다.

```python
__getattr__()
```

둘의 역할은 다르다.

`__getattribute__()`는 거의 모든 Attribute 접근의 시작점이다.

반면 `__getattr__()`는 일반적인 Attribute 탐색이 실패한 뒤에 등장한다.

```python
class Person:
    def __getattr__(self, name):
        return f"{name}은 존재하지 않습니다."


p = Person()
```

이제

```python
p.age
```

를 실행하면 일반적인 Attribute 탐색에서는 `"age"`를 찾을 수 없다.

그 뒤

```python
p.__getattr__("age")
```

가 호출된다.

결과는

```text
"age은 존재하지 않습니다."
```

가 된다.

전체적인 관계는 다음과 같다.

```text
obj.x
 │
 ▼
__getattribute__()
 │
 ▼
일반적인 Attribute 탐색
 │
 ├── 성공 ───────────────→ 값 반환
 │
 └── 실패
      │
      ▼
   __getattr__ 존재?
      │
      ├── YES ───────────→ __getattr__("x")
      │
      └── NO ────────────→ AttributeError
```

---

## 14. 전체 흐름을 하나로 정리하면

이제 지금까지 살펴본 내용을 하나의 흐름으로 연결해보자.

일반적인 instance에서

```python
obj.x
```

를 읽는 과정을 단순화하면 다음과 같다.

```text
obj.x
 │
 ▼
obj.__getattribute__("x")
 │
 ▼
class 쪽에서 "x" 탐색
 │
 ▼
"x"를 찾았는가?
 │
 ├── YES
 │    │
 │    ▼
 │   Data Descriptor인가?
 │    │
 │    ├── YES ───────────────→ descriptor.__get__()
 │    │                              │
 │    │                              ▼
 │    │                           결과 반환
 │    │
 │    └── NO
 │         │
 │    ┌────┘
 │    │
 ▼    ▼
obj.__dict__에 "x"가 있는가?
 │
 ├── YES ────────────────────→ instance attribute 반환
 │
 └── NO
      │
      ▼
class 쪽에서 찾았던 "x"가 있는가?
      │
      ├── YES
      │    │
      │    ▼
      │   Descriptor인가?
      │    │
      │    ├── YES ──────────→ descriptor.__get__()
      │    │
      │    └── NO ───────────→ class attribute 그대로 반환
      │
      └── NO
           │
           ▼
      __getattr__이 있는가?
           │
           ├── YES ──────────→ __getattr__("x")
           │
           └── NO ───────────→ AttributeError
```

핵심적인 우선순위만 다시 뽑으면 훨씬 간단하다.

```text
┌─────────────────────────────┐
│ 1. Data Descriptor          │
│    class / MRO              │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 2. Instance Attribute       │
│    obj.__dict__             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 3. Non-data Descriptor      │
│    또는 일반 class Attribute │
│    class / MRO              │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 4. __getattr__              │
└──────────────┬──────────────┘
               │
               ▼
        AttributeError
```

이 순서에서 가장 중요한 것은 단순히 외우는 것이 아니다.

왜 이런 순서가 만들어졌는지를 이해하는 것이다.

```text
Data Descriptor
       >
instance attribute
       >
Non-data Descriptor / 일반 class attribute
```

이 규칙 때문에

- `property`는 instance attribute보다 강하고,
    
- 일반 method는 instance attribute에 가려질 수 있으며,
    
- 단순한 `obj.x` 접근만으로도 Descriptor가 원하는 코드를 실행할 수 있다.
    

서로 달라 보이던 현상들이 하나의 Attribute 탐색 규칙으로 연결된다.

---

## 15. Attribute는 단순한 값 조회가 아니다

Python 코드를 작성하다 보면 다음 표현들은 너무 자연스러워 보인다.

```python
obj.name
obj.method()
obj.value
```

하지만 이 모든 표현의 밑에는 같은 Attribute 접근 시스템이 존재한다.

예를 들어

```python
obj.name
```

은 단순히 instance `__dict__`에서 값을 가져올 수도 있다.

```text
obj.name
   │
   ▼
obj.__dict__["name"]
```

반면

```python
obj.method
```

에서는 class에 저장된 function의 Descriptor 동작이 개입할 수 있다.

```text
obj.method
   │
   ▼
function Descriptor
   │
   ▼
Bound Method
```

또

```python
obj.value
```

에서는 `property`의 Descriptor 동작이 개입할 수도 있다.

```text
obj.value
   │
   ▼
property Descriptor
   │
   ▼
getter 실행
   │
   ▼
결과 반환
```

겉으로는 모두 똑같은

```python
obj.x
```

형태지만 내부에서는 전혀 다른 일이 일어날 수 있는 것이다.

따라서 Python에서 Attribute는 단순히

> "객체 안에 들어 있는 값을 꺼낸다"

라고 이해하기보다

> **객체와 class에 저장된 정보를 Python의 Attribute 탐색 규칙에 따라 해석하는 과정**

이라고 이해하는 편이 더 정확하다.

그리고 이 구조를 가능하게 하는 핵심 장치 중 하나가 Descriptor Protocol이다.

```text
obj.x
  │
  ▼
Attribute 접근 시스템
  │
  ├── 단순 instance attribute
  │
  ├── class attribute
  │
  ├── Descriptor
  │      ├── function
  │      └── property
  │
  ├── MRO
  │
  └── __getattr__
```

---

## 16. 결국 `obj.x`는 하나의 프로토콜 위에서 해석된다

앞선 글에서 우리는 Attribute가

```text
instance.__dict__
class.__dict__
```

같은 namespace에 저장된다는 것을 살펴봤다.

하지만 저장 위치만 알아서는 Python의 Attribute를 완전히 이해할 수 없다.

저장된 값을 **어떤 규칙으로 읽는가**도 알아야 한다.

```python
obj.x
```

라는 짧은 표현 뒤에는

```text
__getattribute__
Descriptor Protocol
Data Descriptor
Non-data Descriptor
instance namespace
class namespace
MRO
__getattr__
```

같은 규칙들이 숨어 있다.

특히 Descriptor에서 중요한 것은 `__get__()`이라는 메서드가 존재한다는 사실 자체가 아니다.

> **Python이 Attribute를 해석하는 과정에서 Descriptor Protocol을 인식하고, 필요한 순간에 `__get__()`, `__set__()`, `__delete__()` 같은 동작을 호출한다는 것**

이 핵심이다.

각 Descriptor는 그 약속 안에서 자신만의 행동을 정의한다.

```text
Age Descriptor
└── __get__ → 20 반환

function Descriptor
└── __get__ 동작 → instance와 function을 연결

property Descriptor
└── __get__ 동작 → getter 실행
```

그래서 이전에는 서로 별개의 기능처럼 보였던

```text
instance attribute
class attribute
method binding
property
descriptor
inheritance
MRO
```

가 결국 하나의 질문으로 연결된다.

> **"Python은 `obj.x`를 어떻게 해석하는가?"**

이것이 Python의 Attribute 접근을 이해하는 핵심이다.

---

**다음 글: 07. 상속하면 Attribute를 어디서 찾아오는가?**