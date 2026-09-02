---
title: "07. 상속하면 Attribute를 어디서 찾아오는가"
description: "Python의 상속이 Attribute 탐색에 어떤 영향을 주는지 살펴보고, __bases__와 MRO, C3 Linearization, super()를 통해 다중 상속에서도 일관된 탐색 순서가 만들어지는 원리를 이해합니다."
pubDatetime: 2026-09-02T23:40:00+09:00
tags:
  - Python
  - 파이썬 객체에 대한 이해
  - 상속과 MRO
  - Attribute Lookup
draft: false
---

앞선 글에서는 다음과 같은 코드를 실행했을 때,

```python
obj.x
```

Python이 단순히 `obj` 안에서 `x`라는 값을 꺼내는 것이 아니라 **attribute lookup**이라는 탐색 과정을 수행한다는 것을 살펴봤다.

그런데 클래스에 **상속(inheritance)** 이 추가되면 이야기가 조금 더 복잡해진다.

```python
class Animal:
    name = "animal"


class Dog(Animal):
    pass


dog = Dog()

print(dog.name)
```

`dog`에는 `name`이라는 attribute를 직접 저장한 적이 없다.

`Dog`에도 없다.

그런데도 결과는 정상적으로 나온다.

```text
animal
```

그렇다면 Python은 `name`을 어디에서 찾은 것일까?

그리고 부모 클래스가 하나가 아니라 여러 개라면 Python은 **어떤 부모 클래스부터 찾아볼까?**

이 질문을 따라가다 보면 Python의 상속, `__bases__`, MRO, 다중 상속, `super()`가 하나의 흐름으로 연결된다.

---

## 1. 상속은 부모의 Attribute를 복사하는 것이 아니다

먼저 상속에 대해 흔히 가질 수 있는 오해부터 정리해보자.

```python
class Animal:
    name = "animal"


class Dog(Animal):
    pass
```

이를 보고 `Animal`의 attribute가 `Dog` 안으로 복사된다고 생각할 수도 있다.

하지만 실제로 `Dog.__dict__`를 확인해보면 그렇지 않다.

```python
print(Dog.__dict__)
```

여기에는 `Animal`에서 정의한 `name`이 들어 있지 않다.

즉,

```python
Dog.name
```

이 동작한다고 해서 `Dog`가 `name`을 직접 가지고 있는 것은 아니다.

Python은 `Dog`에서 `name`을 찾지 못하면 **상속 관계를 따라 다른 클래스까지 탐색한다.**

개념적으로 보면 다음과 같다.

```text
Dog
 │
 │ 상속
 ▼
Animal
```

그리고

```python
Dog.name
```

을 읽으면,

```text
Dog에서 name 탐색
        │
        │ 없음
        ▼
Animal에서 name 탐색
        │
        │ 발견
        ▼
    "animal"
```

이런 식으로 동작한다.

따라서 상속을 이해할 때 중요한 것은

> **부모 클래스의 attribute가 자식 클래스로 복사되는 것이 아니라, attribute를 찾을 수 있는 탐색 범위가 확장된다.**

는 점이다.

---

## 2. Python은 부모 클래스를 어떻게 알고 있을까?

그렇다면 Python은 `Dog`의 부모가 `Animal`이라는 사실을 어디에 저장하고 있을까?

클래스 객체에는 `__bases__`라는 attribute가 존재한다.

```python
print(Dog.__bases__)
```

결과는 대략 다음과 같다.

```python
(<class '__main__.Animal'>,)
```

`__bases__`는 해당 클래스가 **직접 상속한 부모 클래스들**을 tuple로 가지고 있다.

예를 들어 다중 상속이라면,

```python
class A:
    pass


class B:
    pass


class C(A, B):
    pass
```

```python
print(C.__bases__)
```

결과는 다음과 같다.

```python
(<class '__main__.A'>, <class '__main__.B'>)
```

즉 클래스 선언문의

```python
class C(A, B):
```

에서 지정한 직접 부모 클래스들이 `C.__bases__`에 연결된다.

하지만 여기서 중요한 문제가 하나 생긴다.

`__bases__`는 **직접 부모**만 알려준다.

```text
A
│
B
│
C
```

와 같은 상속 구조에서 `C.__bases__`를 확인하면 `B`만 나온다.

그렇다면 `C`에서 어떤 attribute를 찾을 때

```text
C → B → A
```

라는 전체 탐색 순서는 어떻게 결정되는 것일까?

이 역할을 하는 것이 **MRO(Method Resolution Order)** 다.

---

## 3. MRO는 Attribute를 탐색하는 순서다

MRO는 **Method Resolution Order**의 약자다.

이름만 보면 method를 찾는 규칙처럼 보이지만, 실제로는 method뿐만 아니라 **클래스 계층에서 attribute를 탐색하는 순서**라고 이해하는 편이 좋다.

예를 들어,

```python
class A:
    value = "A"


class B(A):
    value = "B"


class C(B):
    pass
```

`C`의 MRO를 확인해보자.

```python
print(C.__mro__)
```

결과는 다음과 같다.

```text
(C, B, A, object)
```

또는 다음처럼 확인할 수도 있다.

```python
print(C.mro())
```

Python은 `C`를 기준으로 attribute를 탐색해야 할 때 이 순서를 사용한다.

```text
C
↓
B
↓
A
↓
object
```

따라서

```python
C.value
```

를 실행하면,

```text
C.value
 │
 ├─ C      → 없음
 │
 ├─ B      → "B" 발견
 │
 └─ A      → 탐색할 필요 없음
```

결과는 `"B"`가 된다.

즉 상속 관계에서 중요한 것은 단순히

```text
부모를 찾아간다
```

가 아니다.

좀 더 정확하게 표현하면,

> **Python은 클래스의 MRO에 정의된 순서대로 attribute를 탐색한다.**

---

## 4. 모든 클래스의 끝에는 object가 있다

앞의 MRO를 다시 보면 마지막에 항상 익숙한 클래스가 등장한다.

```text
(C, B, A, object)
```

`object`다.

Python에서 특별히 부모 클래스를 지정하지 않아도,

```python
class A:
    pass
```

`A`는 결국 `object`를 기반으로 만들어진다.

```python
print(A.__bases__)
```

```text
(<class 'object'>,)
```

그래서 단순한 클래스의 MRO도 다음과 같다.

```python
print(A.__mro__)
```

```text
(A, object)
```

상속이 길어지더라도 결국 마지막에는 `object`에 도달한다.

```text
Dog
 ↓
Animal
 ↓
object
```

이 구조는 앞서 살펴본

> **Python의 클래스 자체도 객체다.**

라는 이야기와도 연결된다.

Python의 사용자 정의 클래스들은 완전히 독립적인 구조가 아니라 `object`를 기반으로 하는 하나의 객체 모델 위에 존재한다.

---

## 5. 단일 상속에서는 MRO가 직관적이다

부모 클래스가 하나뿐이라면 MRO는 별로 어렵지 않다.

```python
class A:
    pass


class B(A):
    pass


class C(B):
    pass
```

상속 구조는 다음과 같다.

```text
object
  ↑
  A
  ↑
  B
  ↑
  C
```

그리고 MRO는 자연스럽게

```text
C → B → A → object
```

가 된다.

```python
print(C.__mro__)
```

```text
(C, B, A, object)
```

문제는 **다중 상속(multiple inheritance)** 부터 시작된다.

---

## 6. 다중 상속에서는 어떤 부모부터 찾아야 할까?

Python에서는 하나의 클래스가 여러 클래스를 동시에 상속할 수 있다.

```python
class A:
    value = "A"


class B:
    value = "B"


class C(A, B):
    pass
```

구조는 다음과 같다.

```text
    A       B
     \     /
      \   /
        C
```

그렇다면,

```python
print(C.value)
```

결과는 무엇일까?

`"A"`다.

MRO를 확인하면 이유를 알 수 있다.

```python
print(C.__mro__)
```

```text
(C, A, B, object)
```

따라서 Python은 다음 순서로 찾는다.

```text
C
↓
A
↓
B
↓
object
```

`A`에서 `value`를 발견했기 때문에 `B`까지 갈 필요가 없다.

여기까지만 보면 단순히

> `class C(A, B)`라고 작성했으니까 왼쪽부터 찾는다.

라고 생각할 수도 있다.

간단한 상속 구조에서는 어느 정도 맞는 설명이다.

하지만 실제 Python의 규칙은 단순한 **왼쪽 우선 탐색**보다 복잡하다.

---

## 7. Diamond Inheritance 문제

다음과 같은 구조를 생각해보자.

```python
class A:
    pass


class B(A):
    pass


class C(A):
    pass


class D(B, C):
    pass
```

상속 관계를 그리면 다음과 같다.

```text
        A
       / \
      B   C
       \ /
        D
```

다이아몬드처럼 생겼기 때문에 흔히 **Diamond Inheritance**라고 부른다.

여기서 단순히 부모를 재귀적으로 탐색한다고 생각해보자.

`D → B → A`를 탐색한 다음 다시 `C → A`를 탐색한다면 `A`가 두 번 등장한다.

```text
D → B → A → C → A
```

더 복잡한 다중 상속에서는 부모 클래스 간의 우선순위까지 꼬일 수 있다.

Python은 이런 문제를 해결하기 위해 클래스 계층을 하나의 일관된 순서로 정렬한다.

이것이 바로 **C3 Linearization**이다.

---

## 8. C3 Linearization

Python 3는 MRO를 계산하기 위해 **C3 Linearization**이라는 알고리즘을 사용한다.

앞의 구조를 다시 보자.

```text
        A
       / \
      B   C
       \ /
        D
```

```python
print(D.__mro__)
```

결과는 다음과 같다.

```text
(D, B, C, A, object)
```

즉 복잡한 상속 그래프를

```text
D
↓
B
↓
C
↓
A
↓
object
```

라는 **하나의 선형적인 탐색 순서**로 만든다.

그래서 Linearization이라는 이름이 붙는다.

C3가 지키려고 하는 중요한 성질은 크게 다음과 같다.

- 자식 클래스가 부모 클래스보다 먼저 온다.
    
- 클래스 선언에 작성한 부모 클래스의 순서를 최대한 보존한다.
    
- 각 부모 클래스가 이미 가지고 있는 MRO의 순서를 깨뜨리지 않는다.
    

예를 들어,

```python
class D(B, C):
```

라고 선언했다면 `B`가 `C`보다 먼저 등장해야 한다.

동시에 `B`와 `C`가 각각 가지고 있는 상속 관계도 함부로 뒤집어서는 안 된다.

따라서 Python은 단순한 DFS 탐색 대신 전체 상속 관계를 고려하여 **일관된 하나의 순서**를 만든다.

이 글에서 C3 알고리즘의 계산식 자체까지 깊게 들어갈 필요는 없다.

중요한 것은,

> **다중 상속 구조는 그래프이지만 Python은 attribute를 탐색하기 위해 이를 MRO라는 하나의 선형 순서로 만든다.**

는 점이다.

---

## 9. MRO를 만들 수 없는 상속도 있다

C3 Linearization은 아무 상속 관계나 억지로 정렬해주는 알고리즘은 아니다.

서로 모순되는 순서를 요구하면 Python은 아예 클래스를 만들지 못하게 한다.

예를 들어,

```python
class A:
    pass


class B:
    pass


class X(A, B):
    pass


class Y(B, A):
    pass
```

`X`는

```text
A → B
```

순서를 요구하고,

`Y`는

```text
B → A
```

순서를 요구한다.

이 둘을 다시 동시에 상속하려 하면,

```python
class Z(X, Y):
    pass
```

Python은 일관된 MRO를 만들 수 없다.

그래서 클래스 정의 시점에 `TypeError`가 발생한다.

즉 MRO는 단순한 탐색 편의 기능이 아니다.

Python은 클래스가 만들어질 때부터 **상속 계층 전체가 일관된 탐색 순서를 가질 수 있는지 검사한다.**

---

## 10. super()는 부모 클래스를 의미하지 않는다

MRO를 이해하면 `super()`도 다르게 보이기 시작한다.

흔히 `super()`를

> 부모 클래스에 접근하는 기능

이라고 배우곤 한다.

단일 상속에서는 크게 문제가 없는 설명이다.

```python
class Animal:
    def speak(self):
        print("Animal")


class Dog(Animal):
    def speak(self):
        super().speak()
        print("Dog")
```

여기서는 실제로 `Dog` 다음이 `Animal`이기 때문에 `super()`가 부모를 호출하는 것처럼 보인다.

하지만 더 정확한 의미는 다음과 같다.

> **현재 클래스 다음 MRO 위치부터 attribute 탐색을 이어간다.**

다중 상속에서 이 차이가 명확해진다.

```python
class A:
    def hello(self):
        print("A")


class B(A):
    def hello(self):
        print("B")
        super().hello()


class C(A):
    def hello(self):
        print("C")
        super().hello()


class D(B, C):
    def hello(self):
        print("D")
        super().hello()
```

`D`의 MRO는 다음과 같다.

```text
D → B → C → A → object
```

이제 실행해보자.

```python
D().hello()
```

먼저 `D.hello()`가 실행된다.

```text
D
```

그리고 `D`에서 `super()`를 호출한다.

MRO에서 `D` 다음은 `B`다.

```text
D → B
```

따라서 `B.hello()`가 실행된다.

그 안에서도 `super()`가 호출된다.

그런데 여기서 중요한 일이 일어난다.

`B`의 직접 부모는 `A`다.

```python
B.__bases__
```

```text
(A,)
```

하지만 `D`의 MRO에서 `B` 다음은 `A`가 아니라 **C**다.

```text
D → B → C → A → object
        ↑
      다음
```

따라서 `B` 안의 `super()`는 `C.hello()`로 이어진다.

최종 결과는 다음과 같다.

```text
D
B
C
A
```

이것이 `super()`를 단순히

```text
부모 호출
```

이라고 이해하면 안 되는 이유다.

`super()`는 상속 트리를 위로 한 칸 올라가는 기능이라기보다,

> **현재 객체의 MRO를 기준으로 다음 탐색 위치로 이동하는 기능**

에 가깝다.

---

## 11. `__bases__`와 `__mro__`는 무엇이 다른가?

여기까지 오면 둘의 차이를 명확하게 구분할 수 있다.

`__bases__`는 **직접 상속 관계**를 나타낸다.

```python
class D(B, C):
    pass
```

```python
D.__bases__
```

```text
(B, C)
```

반면 `__mro__`는 실제 attribute 탐색에 사용될 **전체 클래스 순서**를 나타낸다.

```python
D.__mro__
```

```text
(D, B, C, A, object)
```

따라서 둘을 다음처럼 생각하면 좋다.

```text
__bases__
    │
    │ 직접적인 상속 관계
    ▼
(B, C)


__mro__
    │
    │ 실제 탐색 순서
    ▼
(D, B, C, A, object)
```

`__bases__`가 클래스 계층의 **연결 관계**를 보여준다면,

MRO는 그 연결 관계를 바탕으로 계산된 **탐색 경로**라고 볼 수 있다.

---

## 12. 결국 Attribute Lookup과 MRO는 하나의 이야기다

앞선 글에서 살펴본 attribute lookup과 이번 글의 MRO는 별개의 기능이 아니다.

예를 들어,

```python
obj.x
```

를 실행했다고 생각해보자.

Python은 먼저 객체의 attribute 접근 메커니즘을 시작한다.

그리고 `x`를 클래스 계층에서 찾아야 한다면 객체의 타입이 가지고 있는 MRO가 사용된다.

개념적으로 단순화하면,

```text
obj.x
 │
 ▼
attribute lookup
 │
 ├─ instance 쪽 탐색
 │
 ▼
type(obj)
 │
 ▼
MRO를 따라 클래스 탐색
 │
 ├─ 현재 class
 ├─ 다음 class
 ├─ 다음 class
 │    ...
 ▼
object
```

여기에 이전 글에서 다룬 descriptor까지 포함하면 실제 규칙은 조금 더 정교해진다.

즉 Python의 attribute 접근을 이해하려면,

```text
instance __dict__
class __dict__
descriptor
inheritance
MRO
```

를 각각 완전히 독립된 개념으로 보기보다 **하나의 attribute lookup 시스템을 구성하는 요소들**로 보는 것이 좋다.

---

## 13. 상속의 본질은 Attribute 탐색 범위를 확장하는 것이다

상속을 처음 배우면 보통 이런 식으로 이해한다.

> 부모 클래스의 기능을 자식 클래스가 물려받는다.

사용하는 입장에서는 충분히 좋은 설명이다.

하지만 Python 객체 모델의 관점에서 한 단계 더 내려가 보면 조금 다른 모습이 보인다.

```python
class Dog(Animal):
    pass
```

이 코드를 실행한다고 해서 `Animal.__dict__`의 내용이 `Dog.__dict__`로 복사되는 것이 아니다.

대신 `Dog`와 `Animal` 사이에 상속 관계가 만들어지고,

```python
Dog.__bases__
```

를 통해 직접적인 부모 관계가 표현되며,

그 관계를 바탕으로

```python
Dog.__mro__
```

라는 탐색 순서가 만들어진다.

그리고 `Dog`에서 어떤 attribute를 찾을 수 없을 때 Python은 그 MRO를 따라 다음 클래스를 탐색한다.

```text
상속 선언

class Dog(Animal)
        │
        ▼
   __bases__
        │
        ▼
상속 계층 구성
        │
        ▼
C3 Linearization
        │
        ▼
      MRO
        │
        ▼
Dog → Animal → object
        │
        ▼
 Attribute Lookup
```

따라서 구현 관점에서 상속을 바라보면,

> **상속은 attribute를 복사하는 기능이 아니라, attribute lookup이 탐색할 수 있는 클래스 계층을 구성하는 기능이다.**

라고 볼 수 있다.

그리고 다중 상속에서는 그 계층이 단순한 직선이 아니기 때문에 Python은 **C3 Linearization**을 이용해 MRO라는 일관된 탐색 순서를 만든다.

`super()` 역시 이 MRO 위에서 동작한다.

결국,

```text
inheritance
    ↓
__bases__
    ↓
class hierarchy
    ↓
C3 Linearization
    ↓
MRO
    ↓
attribute lookup
    ↓
super()
```

이 모든 개념은 하나의 이야기로 연결된다.

---

## 14. 다음 글로 연결

지금까지 객체를 만들고 attribute를 저장하고 읽는 과정을 따라왔다.

```text
객체
 ↓
변수와 객체의 binding
 ↓
CPython에서의 객체 표현
 ↓
class도 객체
 ↓
attribute 저장
 ↓
attribute lookup
 ↓
상속과 MRO
```

이제 객체가 **어떻게 존재하고 동작하는가**에 대한 흐름은 거의 완성되었다.

하지만 아직 한 가지 중요한 질문이 남아 있다.

```python
a = SomeObject()
```

이렇게 만들어진 객체는 메모리에 계속 남아 있을까?

```python
a = None
```

이 되는 순간 바로 사라질까?

Python은 객체가 더 이상 필요하지 않다는 것을 어떻게 판단할까?

그리고 앞서 CPython의 객체 구조에서 잠깐 등장했던

```text
ob_refcnt
```

는 여기서 어떤 역할을 할까?

다음 글에서는 다시 CPython의 메모리 세계로 내려가서,

**객체는 메모리에서 언제 사라지는가?**

를 살펴보자.

---
**다음 글: 08 객체는 메모리에서 언제 사라지는가**
