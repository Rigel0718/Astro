---
title: "05. Attribute는 어디에 저장되는가"
description: "Python의 Instance와 Class에서 Attribute가 어디에 저장되는지 살펴보고, __dict__와 namespace, __slots__을 통해 객체가 Attribute를 가진다는 말의 실제 의미를 이해합니다."
pubDatetime: 2026-09-02T23:30:00+09:00
tags:
  - Python
  - 파이썬 객체에 대한 이해
  - Attribute
  - Namespace
draft: false
---

앞선 글에서는 Python에서 `class` 문이 실행되면 **class 자체도 하나의 객체로 만들어진다**는 것을 살펴보았다.

```python
class Person:
    species = "human"

    def __init__(self, name):
        self.name = name
```

그리고 다음과 같이 `Person`을 호출하면 새로운 instance 객체가 만들어진다.

```python
p = Person("Alice")
```

이제 메모리에는 서로 다른 두 객체가 존재한다.

```text
Person  ─────→ class object
p       ─────→ Person instance object
```

그런데 여기서 새로운 의문이 생긴다.

`species`는 어디에 저장되어 있을까?

`name`은 어디에 저장되어 있을까?

우리는 흔히 다음과 같이 말한다.

> `p` 객체는 `name`이라는 attribute를 가진다.

하지만 Python 내부에서 정말 객체 안에 `name`이라는 값이 직접 박혀 있는 것일까?

이번 글에서는 Python에서 **attribute가 실제로 어디에 저장되는지** 살펴본다.

---
## 1. Attribute란 무엇인가?

먼저 attribute라는 말을 정리해보자.

```python
p.name
Person.species
```

여기서 `name`, `species`를 attribute라고 부른다.

Attribute는 특별한 종류의 변수를 의미한다기보다,

> **어떤 객체에 연결된 이름**

이라고 생각하는 편이 좋다.

앞서 Python의 변수에 대해 살펴봤던 것처럼 Python에서 이름은 객체 자체가 아니다.

```python
x = 10
```

이 코드는 `x`라는 이름을 `10`이라는 객체에 연결한다.

attribute도 기본적인 생각은 비슷하다.

```python
p.name = "Alice"
```

이것 역시 `"Alice"`라는 객체를 `name`이라는 이름과 연결하는 것이다.

다만 일반적인 변수와 차이가 있다면 `name`이라는 이름이 아무 곳에나 존재하는 것이 아니라 **`p`라는 객체의 namespace에 속한다는 것**이다.

```text
일반 변수

name ─────→ "Alice"


instance attribute

p
└── name ─────→ "Alice"
```

그렇다면 이 `p`의 namespace는 실제로 어디에 존재할까?

---
## 2. Instance attribute는 보통 `__dict__`에 저장된다

가장 간단한 클래스를 하나 만들어보자.

```python
class Person:
    pass


p = Person()

p.name = "Alice"
p.age = 20
```

그리고 다음을 확인해보자.

```python
print(p.__dict__)
```

결과는 다음과 같다.

```python
{
    "name": "Alice",
    "age": 20
}
```

우리가 작성했던

```python
p.name = "Alice"
p.age = 20
```

이라는 코드의 attribute들이 그대로 들어 있다.

일반적인 Python 객체에서는 instance별 attribute가 **instance의 `__dict__`에 저장된다.**

개념적으로 보면 다음과 같다.

```text
p
│
└── __dict__
      │
      ├── "name" ─────→ "Alice"
      │
      └── "age"  ─────→ 20
```

따라서 다음 코드를

```python
p.name = "Alice"
```

아주 단순화해서 생각하면,

```python
p.__dict__["name"] = "Alice"
```

와 비슷한 저장 구조를 만든다고 볼 수 있다.

물론 실제 attribute 할당은 `__setattr__` 같은 Python의 attribute 처리 메커니즘을 거치기 때문에 둘이 완전히 같은 연산이라고 말할 수는 없다.

중요한 것은 **일반적인 instance attribute의 최종 저장 장소가 `__dict__`라는 것**이다.

---
## 3. `self.name`도 결국 같은 이야기다

그렇다면 우리가 흔히 `__init__`에서 작성하는 다음 코드는 어떨까?

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
```

특별한 저장 공간이 생기는 것은 아니다.

```python
p = Person("Alice", 20)

print(p.__dict__)
```

결과는 똑같다.

```python
{
    "name": "Alice",
    "age": 20
}
```

`__init__` 안에서

```python
self.name = name
```

이라고 작성했다고 해서 `name`이 클래스 정의 어딘가에 특별히 등록되는 것이 아니다.

이 순간 `self`는 생성된 instance를 가리키고 있으므로,

```python
self.name = name
```

은 결국 **그 instance에 `name`이라는 attribute를 설정하는 것**이다.

따라서 서로 다른 instance를 만들면 각각 별도의 attribute 저장 공간을 가진다.

```python
p1 = Person("Alice", 20)
p2 = Person("Bob", 30)
```

```text
p1
└── __dict__
      ├── name ──→ "Alice"
      └── age  ──→ 20


p2
└── __dict__
      ├── name ──→ "Bob"
      └── age  ──→ 30
```

그래서 `p1.name`을 바꿔도 `p2.name`은 영향을 받지 않는다.

---
## 4. 그렇다면 Class attribute는 어디에 저장될까?

이번에는 class 정의 안에 직접 attribute를 만들어보자.

```python
class Person:
    species = "human"
```

`species`는 instance가 아니라 class에 속한 attribute다.

그렇다면 어디에 저장될까?

앞선 글에서 살펴봤듯이 `Person` 역시 객체다.

따라서 `Person`도 자신에게 정의된 이름들을 관리하는 namespace를 가진다.

이 namespace의 내용은 `Person.__dict__`를 통해 확인할 수 있다.

```python
print(Person.__dict__)
```

출력에는 대략 다음과 같은 내용이 들어 있다.

```text
mappingproxy({
    '__module__': '__main__',
    'species': 'human',
    '__dict__': <attribute '__dict__' of 'Person' objects>,
    '__weakref__': <attribute '__weakref__' of 'Person' objects>,
    '__doc__': None
})
```

즉,

```python
class Person:
    species = "human"
```

의 `species`는 **Person class 객체의 namespace에 들어간다.**

개념적으로 보면 다음과 같다.

```text
Person (class object)
│
└── class namespace
      │
      ├── "__module__" ─────→ "__main__"
      ├── "species" ─────────→ "human"
      ├── "__dict__" ────────→ attribute descriptor
      ├── "__weakref__" ─────→ attribute descriptor
      └── "__doc__" ─────────→ None
```

여기서 중요한 사실이 하나 있다.

class 안에서 정의한 **method도 결국 class의 attribute**다.

```python
class Person:
    species = "human"

    def hello(self):
        print("hello")
```

이번에는 `Person.__dict__`에 `hello`도 들어간다.

```python
print(Person.__dict__)
```

대략 다음과 같은 모습을 확인할 수 있다.

```text
mappingproxy({
    '__module__': '__main__',
    'species': 'human',
    'hello': <function Person.hello at 0x...>,
    '__dict__': <attribute '__dict__' of 'Person' objects>,
    '__weakref__': <attribute '__weakref__' of 'Person' objects>,
    '__doc__': None
})
```

이를 구조로 표현하면 다음과 같다.

```text
Person (class object)
│
└── class namespace
      │
      ├── "__module__" ─────→ "__main__"
      ├── "species" ─────────→ "human"
      ├── "hello" ───────────→ <function Person.hello>
      ├── "__dict__" ────────→ attribute descriptor
      ├── "__weakref__" ─────→ attribute descriptor
      └── "__doc__" ─────────→ None
```

즉 class의 관점에서 `species`와 `hello`는 모두 자신의 namespace에 존재하는 attribute다.

차이가 있다면 각 이름이 가리키는 객체의 종류가 다를 뿐이다.

```text
"species" ─────→ "human"

"hello" ───────→ <function Person.hello>
```

`species`는 문자열 객체를 가리키고 있고, `hello`는 함수 객체를 가리키고 있다.

따라서 다음과 같이 직접 확인할 수도 있다.

```python
Person.__dict__["species"]
```

```text
'human'
```

그리고,

```python
Person.__dict__["hello"]
```

```text
<function Person.hello at 0x...>
```

특히 `hello`가 처음부터 특별한 형태의 method로 저장되어 있는 것이 아니라 **class namespace에는 function object로 존재한다**는 점은 이후 method와 descriptor를 이해할 때 중요해진다.

---
## 5. Instance와 Class는 서로 다른 namespace를 가진다

이제 instance attribute와 class attribute를 함께 놓고 비교해보자.

```python
class Person:
    species = "human"

    def __init__(self, name):
        self.name = name


p = Person("Alice")
```

여기서 `p`는 `Person`으로부터 생성된 instance다.

`p`에는 `name`이라는 instance attribute가 있고, `Person`에는 `species`라는 class attribute가 있다.

각각의 namespace를 확인해보면 차이가 더 명확하다.

```python
print(p.__dict__)
```

```text
{
    'name': 'Alice'
}
```

반면 `Person.__dict__`에는 다음과 같은 내용이 존재한다.

```text
mappingproxy({
    '__module__': '__main__',
    'species': 'human',
    '__init__': <function Person.__init__ at 0x...>,
    '__dict__': <attribute '__dict__' of 'Person' objects>,
    '__weakref__': <attribute '__weakref__' of 'Person' objects>,
    '__doc__': None
})
```

즉 `name`과 `species`는 같은 장소에 저장되어 있지 않다.

하지만 그렇다고 `p`와 `Person`이 완전히 독립적으로 떨어져 있는 것도 아니다.

`p`는 자신이 어떤 class의 instance인지 알고 있으며, 자신의 type인 `Person`과 연결되어 있다.

전체 구조를 단순화하면 다음과 같다.

```text
p
│
▼
┌─────────────────────────────┐
│ Person instance             │
│                             │
│ instance namespace          │
│   "name" ───────→ "Alice"   │
│                             │
│ type ─────────────────────────────┐
└─────────────────────────────┘     │
                                    │
                                    ▼
                         ┌─────────────────────────────┐
                         │ Person (class object)       │
                         │                             │
                         │ class namespace             │
                         │   "species" ──→ "human"     │
                         │   "__init__" ─→ function    │
                         └─────────────────────────────┘
```

따라서 instance와 class의 관계는 **namespace가 하나로 합쳐져 있는 구조가 아니다.**

각각 자신의 namespace를 따로 가지고 있다.

```text
Person instance
│
└── instance namespace
      └── "name" ─────→ "Alice"


Person class
│
└── class namespace
      ├── "species" ───→ "human"
      └── "__init__" ──→ function object
```

그러면서 동시에 instance는 자신의 class와 연결되어 있다.

```text
Person instance ───── type ─────→ Person class
```

이 구조를 기준으로 보면,

```python
p.name
```

의 `name`은 **instance 쪽 namespace**에 저장되어 있고,

```python
Person.species
```

의 `species`는 **class 쪽 namespace**에 저장되어 있다.

즉 instance attribute와 class attribute는 서로 같은 공간에 섞여 있는 것이 아니라 **서로 다른 객체의 namespace에 각각 저장된다.**

하나는 instance 쪽 namespace에 있고,

다른 하나는 class 쪽 namespace에 있다.

그리고 instance는 자신의 class와 연결되어 있다.

이 차이가 바로 **instance attribute와 class attribute를 구분하는 핵심**이다.

---
## 6. Namespace란 결국 무엇인가?

여기까지 보면 `namespace`라는 단어가 계속 등장한다.

Python에서 namespace는 거창한 개념이라기보다 기본적으로

> **이름과 객체의 연결을 관리하는 공간**

이라고 생각하면 된다.

예를 들어,

```python
p.name = "Alice"
```

가 있다면 instance namespace에는

```text
"name" ─────→ "Alice"
```

라는 연결이 존재한다.

그리고

```python
class Person:
    species = "human"
```

이라면 class namespace에는

```text
"species" ─────→ "human"
```

이라는 연결이 존재한다.

이 관점에서 보면 이전 글에서 살펴본 Python의 변수와 attribute가 사실 완전히 동떨어진 개념은 아니다.

Python은 계속해서 **이름과 객체의 연결**을 만들고 있다.

차이가 있다면 그 이름이 **어느 namespace에 존재하느냐**다.

```text
module namespace
    x ─────────→ object


class namespace
    species ───→ object


instance namespace
    name ──────→ object
```

Python의 많은 동작은 결국

**"이 이름은 어느 namespace에 존재하는가?"**

라는 문제와 연결된다.

---
## 7. 같은 이름이 Instance와 Class에 동시에 존재할 수도 있다

여기서 재미있는 상황을 만들어보자.

```python
class Person:
    name = "class name"


p = Person()
p.name = "instance name"
```

현재 구조는 다음과 같다.

```text
Person
└── namespace
      └── name ─────→ "class name"


p
└── __dict__
      └── name ─────→ "instance name"
```

즉 `name`이라는 동일한 이름이 두 namespace에 동시에 존재할 수 있다.

```python
print(Person.name)
print(p.name)
```

그렇다면 Python은 `p.name`이라는 코드에서 어떤 `name`을 선택해야 할까?

instance의 `name`일까?

class의 `name`일까?

여기서부터는 단순히 **어디에 저장되는가**의 문제가 아니라,

> **attribute를 읽을 때 Python이 어디를 어떤 순서로 탐색하는가**

의 문제가 된다.

이것이 다음 글에서 다룰 attribute lookup의 출발점이다.

---
## 8. 모든 Instance가 반드시 `__dict__`를 가지는 것은 아니다

지금까지는 일반적인 Python 객체를 기준으로 설명했다.

하지만 attribute가 항상 `__dict__`에만 저장되는 것은 아니다.

대표적인 예외가 `__slots__`다.

```python
class Person:
    __slots__ = ("name", "age")

    def __init__(self, name, age):
        self.name = name
        self.age = age
```

이렇게 정의하면 일반적으로 instance마다 별도의 `__dict__`를 만들지 않고, 미리 정의된 attribute를 위한 저장 공간을 사용한다.

그래서 다음 코드는 실패한다.

```python
p = Person("Alice", 20)

print(p.__dict__)
```

일반적인 경우 `p`에는 `__dict__` 자체가 없다.

개념적으로 비교하면 다음과 같다.

```text
일반적인 instance

p
└── __dict__
      ├── name ──→ "Alice"
      └── age  ──→ 20
```

반면 `__slots__`을 사용하면 개념적으로는

```text
p
├── [name slot] ──→ "Alice"
└── [age slot]  ──→ 20
```

처럼 정해진 attribute를 위한 저장 공간을 사용한다고 이해할 수 있다.

이 때문에 instance마다 dictionary를 유지하는 비용을 줄일 수 있고, 임의의 새로운 attribute가 추가되는 것도 제한할 수 있다.

```python
p.address = "Seoul"
```

`address`가 slot으로 정의되어 있지 않다면 일반적으로 `AttributeError`가 발생한다.

다만 여기서 중요한 것은 `__slots__` 자체보다 더 큰 원리다.

> **Attribute는 반드시 객체의 `__dict__`에 저장되어야 하는 것은 아니다.**

`__dict__`는 Python에서 attribute를 저장하는 매우 일반적인 방식일 뿐, attribute라는 개념 그 자체는 아니다.

---
## 9. "객체가 Attribute를 가진다"는 말의 실제 의미

이제 처음의 질문으로 돌아가보자.

우리는 흔히 다음과 같이 말한다.

> `p` 객체는 `name` attribute를 가진다.

Python을 처음 배울 때는 이것을 마치 객체라는 상자 안에 `name`이라는 변수가 들어 있는 것처럼 생각하기 쉽다.

```text
p
┌──────────────┐
│ name="Alice" │
│ age=20       │
└──────────────┘
```

사용하는 입장에서는 이렇게 생각해도 큰 문제가 없다.

하지만 Python의 객체 모델을 조금 더 정확하게 바라보면 이야기가 달라진다.

일반적인 instance에서는

```text
p
│
└── __dict__
      │
      ├── "name" ─────→ "Alice"
      └── "age"  ─────→ 20
```

처럼 객체가 가진 namespace 안에서 **attribute 이름과 다른 객체 사이의 연결이 관리된다.**

class attribute 역시 마찬가지다.

```text
Person
│
└── namespace
      │
      ├── "species" ───→ "human"
      └── "hello" ─────→ function object
```

그리고 경우에 따라 `__slots__`처럼 dictionary가 아닌 다른 저장 방식도 사용할 수 있다.

따라서

> **"객체가 attribute를 가진다"는 것은 객체와 관련된 namespace 또는 attribute 저장 구조를 통해 특정 이름이 어떤 객체와 연결되어 있다는 의미에 가깝다.**

이렇게 이해하면 Python의 객체 모델이 훨씬 일관되게 보이기 시작한다.

---
## 10. Attribute의 저장과 탐색은 다른 문제다

여기서 이번 글에서 반드시 구분해야 할 것이 있다.

**Attribute가 어디에 저장되는가**와  
**Attribute를 어디서 찾아오는가**는 서로 다른 문제다.

예를 들어 다음 코드에서

```python
class Person:
    species = "human"

    def __init__(self, name):
        self.name = name


p = Person("Alice")
```

저장 위치만 보면 비교적 단순하다.

```text
Person
└── namespace
      └── species ─────→ "human"


p
└── __dict__
      └── name ────────→ "Alice"
```

그런데 다음 코드가 가능하다.

```python
print(p.species)
```

`species`는 `p.__dict__`에 없다.

```python
print(p.__dict__)
# {'name': 'Alice'}
```

그런데도 Python은 `p.species`를 정상적으로 찾아낸다.

왜일까?

여기서부터 Python의 attribute system에서 더 중요한 이야기가 시작된다.

`p.name`이라는 코드를 실행했을 때 Python은 단순히 `p.__dict__["name"]`만 확인하는 것이 아니다.

instance와 class를 확인하고, 상속 관계를 따라가기도 하며, 경우에 따라 descriptor라는 특별한 객체가 이 과정에 개입하기도 한다.

즉,

```python
p.attribute
```

라는 짧은 문법 뒤에는 생각보다 복잡한 **attribute lookup 규칙**이 숨어 있다.

---
**다음 글: 06 Attribute를 읽으면 내부에서 어떤 일이 일어나는 가**