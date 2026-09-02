---
title: "04. Class는 어떻게 객체가 되는가"
description: "Python에서 Class 자체가 Runtime에 존재하는 객체라는 의미를 살펴보고, Class Object의 생성 과정과 type, object, Instance와 Class의 관계를 하나의 객체 모델로 이해합니다."
pubDatetime: 2026-09-02T23:25:00+09:00
tags:
  - Python
  - 파이썬 객체에 대한 이해
  - Class Object
  - type과 object
draft: false
---

앞선 글에서는 Python의 객체가 CPython 메모리에서 어떻게 표현되는지 살펴봤다.

Python의 객체는 메모리 어딘가에 존재하고, 변수는 그 객체 자체를 담는 것이 아니라 객체를 가리킨다.

그리고 CPython에서 모든 객체는 기본적으로 다음과 같은 정보를 가진다.

```text
PyObject
├── ob_refcnt
└── ob_type
```

여기서 `ob_type`은 객체가 어떤 Type을 가지는지를 나타낸다.

예를 들어,

```python
x = 10
```

에서 `x`가 가리키는 객체는 `int` 타입이다.

```python
type(x)
```

```text
<class 'int'>
```

그런데 Python에서는 이 `int` 역시 직접 하나의 값처럼 다룰 수 있다.

```python
t = int

print(t)
```

```text
<class 'int'>
```

함수의 인자로 전달할 수도 있다.

```python
def show(value):
    print(value)

show(int)
```

즉 `int`는 단순히 소스 코드에 적혀 있는 타입 이름이 아니다.

Python Runtime에 실제로 존재하며, 이름에 Binding되고 다른 곳으로 전달될 수 있는 대상이다.

그리고 이러한 특징은 우리가 직접 만드는 Class에도 그대로 이어진다.

---

## 1. Class는 단순한 설계도가 아니다

객체지향을 처음 배울 때 Class는 흔히 **객체를 만들기 위한 설계도**라고 설명한다.

```python
class Person:
    pass

p = Person()
```

이 설명 자체가 틀린 것은 아니다.

`Person`을 이용해서 `p`라는 Instance를 만들기 때문이다.

```text
Person
   │
   └──→ p
```

하지만 Python의 객체 모델을 이해하기에는 이 설명만으로는 부족하다.

Python에서 `Person`은 단순히 소스 코드에 적혀 있는 선언이나 추상적인 설계도가 아니다.

`class` 문이 실행되면 실제 **Class Object**가 만들어진다.

```python
class Person:
    pass
```

이 코드가 실행된 이후에는 메모리 어딘가에 `Person`이라는 Class Object가 존재한다.

그리고 `Person`이라는 이름이 그 객체를 가리키게 된다.

```text
Person
  │
  │ reference
  ▼
┌─────────────────────┐
│ Person class object │
└─────────────────────┘
```

이 구조는 앞에서 살펴본 일반적인 이름과 객체의 관계와 크게 다르지 않다.

```python
x = 10
```

이라면,

```text
x
│
▼
┌─────────────────────┐
│ int object: 10      │
└─────────────────────┘
```

이고,

```python
class Person:
    pass
```

라면,

```text
Person
│
▼
┌─────────────────────┐
│ Person class object │
└─────────────────────┘
```

이다.

대상이 정수 객체에서 Class Object로 바뀌었을 뿐이다.

즉,

> **Python에서 `class`는 Class를 정의하는 문법인 동시에, 그 실행 결과로 실제 Class Object를 만든다.**

Class를 단순한 설계도로만 이해하면 이 부분이 보이지 않는다.

Python의 객체 모델에서 Class를 이해하려면 먼저 **Class 자체도 Runtime에 존재하는 하나의 객체**라는 사실에서 출발해야 한다.

---

## 2. Class도 하나의 객체처럼 다룰 수 있다

`Person`이 실제 객체라는 사실은 Python 코드에서도 확인할 수 있다.

Python의 다른 객체처럼 새로운 이름을 붙일 수 있다.

```python
class Person:
    pass

A = Person
```

이때 새로운 Class가 만들어지는 것은 아니다.

`A`와 `Person`이 같은 Class Object를 가리킨다.

```text
Person ───┐
          │
          ├──→ [ Person class object ]
          │
A ────────┘
```

따라서,

```python
Person is A
```

의 결과는

```text
True
```

다.

함수의 인자로 전달할 수도 있다.

```python
def create(cls):
    return cls()

p = create(Person)
```

리스트나 딕셔너리에 저장하는 것도 가능하다.

```python
classes = [Person, int, str]
```

이것이 가능한 이유는 특별하지 않다.

`Person`, `int`, `str` 모두 Python Runtime에 존재하는 **객체**이기 때문이다.

즉 Class가 객체라는 말은 단순한 표현이 아니라,

**"Class 역시 다른 Python 객체와 마찬가지로 이름에 Binding되고, 전달되고, 저장될 수 있다."**

는 말이다.

여기까지 보면 `Person`이 객체라는 사실은 분명해진다.

그리고 모든 Python 객체가 자신의 Type을 가진다면, Class Object인 `Person` 역시 자신의 Type을 가져야 한다.

---

## 3. 그렇다면 Person의 Type은 무엇일까?

여기서 한 단계 더 들어가 보자.

```python
class Person:
    pass

p = Person()
```

`p`의 타입을 확인하면 예상대로 `Person`이 나온다.

```python
type(p)
```

```text
<class '__main__.Person'>
```

즉 다음과 같은 관계다.

```text
p
│
│ type
▼
Person
```

그런데 앞에서 `Person` 역시 객체라고 했다.

그렇다면 `Person` 역시 자신의 타입을 가지고 있어야 한다.

```python
type(Person)
```

결과는 다음과 같다.

```text
<class 'type'>
```

따라서 관계를 한 단계 더 확장할 수 있다.

```text
p
│
│ type
▼
Person
│
│ type
▼
type
```

`Person`은 `p`의 타입이면서,

동시에 `Person` 자신은 `type`이라는 타입을 가진 객체다.

즉,

> **Python에서 Class는 객체의 타입을 정의하는 존재이면서, 그 자체도 다시 타입을 가진 하나의 객체다.**

이 관계를 이해하면 Instance와 Class를 완전히 별개의 존재로 바라볼 필요가 없어진다.

둘은 역할은 다르지만 같은 Python 객체 모델 안에 존재한다.

---

## 4. Instance와 Class는 어떻게 연결되어 있을까?

앞에서 `Person` 자체도 하나의 객체이며, 그 객체 역시 자신의 Type을 가진다는 사실을 확인했다.

이제 `Person`으로 만들어진 Instance까지 함께 놓고 보면 Python의 객체 구조가 조금 더 선명해진다.

```python
class Person:
    pass

p = Person()
```

`p`는 `Person`을 통해 만들어진 Instance다.

그리고 `Person` 역시 하나의 Class Object다.

이 관계를 하나로 연결하면 다음과 같다.

```text
┌─────────────────────┐
│ Person instance: p  │
└─────────────────────┘
          │
          │ type
          ▼
┌─────────────────────┐
│ Person class object │
└─────────────────────┘
          │
          │ type
          ▼
┌─────────────────────┐
│ type                │
└─────────────────────┘
```

여기서 중요한 것은 **Instance와 Class가 완전히 별개의 구조로 존재하는 것이 아니라는 점**이다.

`p`는 객체이고, `Person`도 객체다.

다만 두 객체가 맡고 있는 역할이 다르다.

```text
p
└── Person을 Type으로 가지는 Instance

Person
└── p의 Type이 되는 Class Object
```

즉 `Person`은 한쪽에서는 `p`의 Type이지만, 다른 한쪽에서는 자신도 Type을 가지는 하나의 객체다.

```text
p
│
│ type
▼
Person
│
│ type
▼
type
```

이렇게 Python에서는 Instance에서 Class로 올라갔다고 해서 객체의 세계가 끝나는 것이 아니다.

**Instance의 Type인 Class 역시 다시 하나의 객체로 존재하고, 자신의 Type과 연결된다.**

따라서 Python의 객체 모델에서는 Instance와 Class를 완전히 분리된 두 종류의 존재로 바라보기보다, **Type이라는 관계를 통해 하나의 객체 모델 안에서 연결된 객체들로 바라볼 수 있다.**

이 구조는 앞서 살펴본 CPython의 객체 구조와도 이어진다.

03편에서는 서로 다른 Python 객체들이 공통적인 객체 구조를 기반으로 표현된다는 것을 살펴봤다.

Class Object 역시 여기서 벗어나지 않는다.

CPython에서는 Class와 Type을 표현하기 위해 `PyTypeObject`라는 구조를 사용하며, 이 역시 Python 객체로서 필요한 공통적인 기반을 가진다.

즉 `Person`이 객체라는 것은 단순히 Python 문법 수준에서만 그렇게 취급한다는 의미가 아니다.

**CPython의 구현에서도 Class는 Python Object Model 안에 존재하는 실제 객체다.**

다만 `PyTypeObject`의 구체적인 내부 구조까지 들어가는 것은 이번 글의 목적이 아니다.

여기서는 **Instance와 Class 모두 같은 객체 모델 위에 존재한다**는 점이 중요하다.

지금까지는 `Person`이라는 Class Object가 실제로 존재한다는 사실을 살펴봤다.

이제 이 객체가 Runtime에서 **어떤 과정을 거쳐 만들어지는지** 살펴볼 차례다.

---

## 5. `class` 문을 실행하면 무슨 일이 일어날까?

다음 코드를 조금 다르게 바라보자.

```python
class Person:
    species = "human"

    def hello(self):
        print("hello")
```

우리는 보통 이것을

> Person이라는 Class를 선언했다.

라고 표현한다.

하지만 Python에서 `class` 문은 단순히 컴파일러에게 타입 정보를 알려주는 선언으로 끝나지 않는다.

**실제로 실행되는 문장이다.**

큰 흐름만 보면 다음과 같은 일이 일어난다.

```text
1. Class Body를 실행할 Namespace를 준비한다.

2. Class Body를 실행한다.

   species = "human"
   hello = <function object>

3. 만들어진 Namespace를 이용해
   Class Object를 생성한다.

4. 만들어진 Class Object를
   Person이라는 이름에 Binding한다.
```

Class Body가 실행되면서 개념적으로 다음과 같은 Namespace가 만들어진다.

```text
{
    "species": "human",
    "hello": <function object>
}
```

그리고 이 정보가 Class Object를 만드는 데 사용된다.

```text
Class Namespace
      │
      ▼
┌────────────────────────┐
│ species → "human"      │
│ hello   → <function>   │
└────────────────────────┘
      │
      │ Class 생성
      ▼
┌────────────────────────┐
│ Person class object    │
└────────────────────────┘
      │
      │ Binding
      ▼
    Person
```

여기서 `hello` 역시 Function Object다.

즉 Class 내부에서도 같은 객체 모델이 계속 이어진다.

```text
Person
  │
  ▼
┌────────────────────────┐
│ Person class object    │
│                        │
│ species ──→ str object │
│ hello   ──→ function   │
└────────────────────────┘
```

Class라는 특별한 영역에 들어갔다고 해서 Python이 전혀 다른 원리를 사용하는 것이 아니다.

Class Body가 실행되면서 이름과 객체의 Binding이 만들어지고, 그렇게 구성된 Namespace가 다시 Class Object를 만드는 데 사용된다.

여기까지가 `class` 문이 **Class Object를 만들기 위한 정보를 구성하는 과정**이다.

그리고 일반적인 Python Class에서는 이렇게 만들어진 정보를 바탕으로 실제 Class Object를 생성하는 과정의 중심에 `type`이 존재한다.

---

## 6. Class Object를 만드는 핵심은 `type`이다

앞에서 다음 결과를 확인했다.

```python
type(Person)
```

```text
<class 'type'>
```

일반적인 Python Class에서 Class Object를 만드는 핵심적인 역할을 하는 것이 바로 `type`이다.

실제로 `type()`을 이용해 Class Object를 직접 만들 수도 있다.

```python
Person = type(
    "Person",
    (),
    {
        "species": "human"
    }
)
```

이 코드는 개념적으로 다음과 비슷한 Class를 만든다.

```python
class Person:
    species = "human"
```

`type()`에 전달되는 값을 살펴보면 Class를 구성하는 핵심 요소가 보인다.

```python
type(
    "Person",                 # Class 이름
    (),                       # 부모 Class
    {"species": "human"}      # Namespace
)
```

즉 크게 보면,

```text
Class 이름
    +
부모 Class
    +
Namespace
    │
    ▼
Class Object
```

라는 구조다.

앞에서 살펴본 `class` 문의 흐름과 연결해보면 조금 더 선명해진다.

```text
class Person:
    ...
       │
       ▼
Class Body 실행
       │
       ▼
Namespace 구성
       │
       ▼
Class Object 생성
       │
       ▼
Person에 Binding
```

그리고 일반적인 경우 이 **Class Object 생성 과정의 중심에 `type`이 존재한다.**

물론 더 정확히 들어가면 Class Object는 **Metaclass**에 의해 만들어지며, 기본 Metaclass가 `type`이다.

하지만 Metaclass의 구체적인 동작은 이번 글의 범위를 넘어간다.

여기서는

> **일반적인 Python Class는 `type`을 자신의 Type으로 가지며, `type`은 Class Object를 생성하는 기본적인 역할도 담당한다.**

정도로 이해하면 충분하다.

이것은 Python의 `class`가 단순히 소스 코드에 존재하는 정적인 선언만은 아니라는 사실을 다시 보여준다.

**Class 역시 Runtime에서 실제로 구성되고 만들어지는 객체다.**

여기서 `type`은 Class Object의 Type이라는 역할과 Class Object를 만드는 기본 Metaclass라는 역할을 함께 가지고 있다.

하지만 Python의 Class 구조에는 `type`과 함께 자주 등장하는 또 하나의 중요한 Class가 있다.

바로 `object`다.

---

## 7. `object`는 어디에 있을까?

Python 객체 모델의 또 다른 중요한 Class인 `object`를 살펴보자.

```python
class Person:
    pass
```

부모 Class를 명시하지 않았지만,

```python
Person.__bases__
```

를 확인하면,

```text
(<class 'object'>,)
```

가 나온다.

즉 일반적인 Python Class의 상속 구조를 따라 올라가면 가장 위에는 `object`가 존재한다.

```text
Person
  │
  │ inheritance
  ▼
object
```

그런데 `object` 역시 Class Object다.

```python
type(object)
```

```text
<class 'type'>
```

따라서 여기서는 **두 가지 관계를 구분해야 한다.**

먼저 상속 관계다.

```text
Person
   │
   │ inherits
   ▼
 object
```

그리고 타입 관계다.

```text
Person ─────→ type
object ─────→ type
```

`object`와 `type`은 같은 역할을 하는 것이 아니다.

- `object`는 대부분의 일반적인 Python Class가 도달하는 **상속 계층의 기반**
    
- `type`은 일반적인 Class Object의 **Type**
    

이라고 볼 수 있다.

그리고 `type` 역시 상속 관계에서는 `object`를 기반으로 한다.

```python
type.__bases__
```

```text
(<class 'object'>,)
```

따라서 Python의 Class를 바라볼 때는 **상속 관계와 타입 관계를 분리해서 생각하는 것**이 중요하다.

```text
             type
              ▲
              │ type
              │
            Person
              │
              │ inheritance
              ▼
            object
```

`Person → object`는 **상속 관계**이고,

`Person → type`은 **타입 관계**다.

이 두 관계가 서로 다른 축으로 동시에 존재한다.

즉 `object`와 `type`은 서로 경쟁하는 개념이 아니다.

**`object`는 상속 구조의 기반이고, `type`은 Class Object의 타입 구조를 담당한다.**

이 둘을 분리해서 보면 Python의 Class 구조를 훨씬 명확하게 이해할 수 있다.

---

## 8. 그렇다면 `type` 자신의 Type은 무엇일까?

여기까지 오면 타입 관계에서 한 가지 중요한 부분이 남는다.

`p`의 타입은 `Person`이다.

```python
type(p) is Person
```

그리고 `Person`의 타입은 `type`이다.

```python
type(Person) is type
```

그렇다면 `type`의 타입은 무엇일까?

```python
type(type)
```

결과는,

```text
<class 'type'>
```

이다.

즉,

```python
type(type) is type
```

```text
True
```

다.

구조를 그려보면 다음과 같다.

```text
p
│
│ type
▼
Person
│
│ type
▼
type
▲  │
└──┘
```

`type`은 일반적인 Class Object의 Type이면서 자기 자신 역시 `type`의 Instance다.

덕분에 타입 관계가

```text
type → ? → ? → ? → ...
```

처럼 끝없이 새로운 Type을 요구하지 않고 `type`에서 닫힌다.

여기까지의 관계를 정리하면 크게 두 축으로 볼 수 있다.

```text
타입 관계

p
│
▼
Person
│
▼
type
▲  │
└──┘
```

그리고,

```text
상속 관계

Person
│
▼
object
```

이다.

이 구조를 단순히

> `object`가 있고, `type`이 있고, `type(type)`은 `type`이다.

라고 외우는 것은 별 의미가 없다.

중요한 것은 Python이 **Instance뿐만 아니라 Class까지 하나의 객체 모델 안에 포함시켰다**는 점이다.

이제 이 구조가 단순한 구현상의 특징이 아니라 Python의 언어 설계와 어떻게 연결되는지 살펴볼 수 있다.

---

## 9. Python은 왜 Class까지 객체로 만들었을까?

Class를 반드시 객체로 만들어야만 프로그래밍 언어를 만들 수 있는 것은 아니다.

Class를 일반적인 객체와 구분되는 특별한 타입 선언으로 취급하는 방식도 생각할 수 있다.

그렇게 한다면 Runtime에는 서로 다른 두 세계가 존재하게 된다.

```text
Runtime에서 다루는 값
────────────────────
int
str
list
function
instance


Type을 정의하는 특별한 존재
────────────────────
class
```

Python은 다른 방향을 선택했다.

Class 역시 Runtime에 존재하는 객체로 만들고 **기존의 객체 모델 안에 포함시켰다.**

```text
             Python Runtime

┌────────────────────────────────┐
│                                │
│  10         → object           │
│  "hello"    → object           │
│  function   → object           │
│  Person     → object           │
│                                │
└────────────────────────────────┘
```

따라서 Class를 만났다고 해서 완전히 새로운 규칙이 시작되지 않는다.

```python
x = 10
```

에서는 `x`라는 이름이 정수 객체를 가리키고,

```python
def hello():
    pass
```

에서는 `hello`라는 이름이 Function Object를 가리키며,

```python
class Person:
    pass
```

에서는 `Person`이라는 이름이 Class Object를 가리킨다.

```text
x       ─────→ [ int object ]
hello   ─────→ [ function object ]
Person  ─────→ [ class object ]
```

대상의 역할은 다르지만 **이름이 객체를 가리킨다는 기본 구조는 동일하다.**

그리고 모든 객체가 자신의 Type을 가지듯 Class Object 역시 자신의 Type을 가진다.

```text
p
│
│ type
▼
Person
│
│ type
▼
type
```

이 구조에서 `type`은 Class Object가 어떤 종류의 객체인지를 나타내는 타입의 중심이 되고,

`object`는 Class들이 공유하는 상속 계층의 기반이 된다.

```text
Class도 Runtime Object로 다룬다
              │
              ├── Class Object의 Type ───────→ type
              │
              └── 상속 계층의 기반 ─────────→ object
```

이렇게 바라보면 `object`와 `type`이 단순히 Python에 존재하는 두 개의 특별한 Class가 아니라,

**Class까지 하나의 객체 모델 안에서 다루기 위한 두 개의 중요한 축**이라는 사실이 조금 더 분명해진다.

Python은 객체를 만드는 Class를 객체 시스템 바깥의 특별한 존재로 분리하지 않았다.

**Class까지 기존 객체 모델 안에 포함시키는 방향을 선택했다.**

그리고 이 선택 덕분에 Class 자체도 Runtime에서 다룰 수 있는 대상이 된다.

---

## 10. Class가 객체이기 때문에 가능한 것들

Class가 Runtime의 실제 객체라는 것은 단순히

```python
type(Person) is type
```

이라는 재미있는 특징을 만들기 위한 것이 아니다.

Class 자체가 Runtime에서 다룰 수 있는 대상이 된다.

예를 들어 다음과 같은 Class들이 있다고 해보자.

```python
class Cat:
    pass

class Dog:
    pass
```

Python에서는 Class 자체를 다른 객체처럼 저장할 수 있다.

```python
animal_types = {
    "cat": Cat,
    "dog": Dog,
}
```

그리고 실행 중에 어떤 Class를 사용할지 선택할 수도 있다.

```python
animal_type = animal_types["cat"]

animal = animal_type()
```

여기서 중요한 것은 `Cat`과 `Dog`가 단순히 소스 코드에 적혀 있는 타입 이름이 아니라는 점이다.

```text
"cat"
  │
  ▼
Cat class object
  │
  │ call
  ▼
Cat instance
```

**Class 자체가 Runtime에서 선택되고 전달될 수 있는 실제 객체다.**

Python은 이 성질을 더 확장해서 Class를 동적으로 만들거나, Class가 만들어지는 과정에 개입하거나, 만들어진 Class를 다른 코드에서 등록하고 활용하는 것도 가능하게 한다.

Class Decorator나 Metaclass, 여러 Framework에서 볼 수 있는 동적인 Class 처리 역시 이러한 객체 모델을 기반으로 한다.

하지만 각각의 기능을 외우는 것이 여기서 중요한 것은 아니다.

중요한 것은 그 아래에 있는 구조다.

> **Python은 객체를 만드는 Class를 객체 시스템 밖의 특별한 존재로 분리하지 않았다.**

Class까지 Runtime의 객체로 만들었기 때문에 Python은 객체에 적용되던 여러 성질을 Class에도 자연스럽게 확장할 수 있다.

즉 Python에서 Class가 동적으로 다뤄질 수 있는 것은 별도의 특수한 기능이 우연히 추가되었기 때문이 아니다.

**Class 자체가 처음부터 Runtime Object이기 때문에 자연스럽게 따라오는 성질이다.**

이것이 Python이 Class를 객체로 다루면서 얻는 가장 중요한 특징 중 하나다.

---

## 11. 정리

Python에서

```python
class Person:
    pass
```

를 작성하면 단순히 `Person`이라는 설계도가 선언되는 것이 아니다.

`class` 문이 실행되고,

```text
Class Body 실행
      │
      ▼
Namespace 구성
      │
      ▼
Class Object 생성
      │
      ▼
Person이라는 이름에 Binding
```

이라는 과정이 일어난다.

그리고 만들어진 `Person`은 실제 Python 객체다.

```python
type(Person)
```

```text
<class 'type'>
```

따라서 타입 관계에서는,

```text
p
│
│ type
▼
Person
│
│ type
▼
type
▲  │
└──┘
```

라는 구조가 존재한다.

동시에 상속 관계에서는,

```text
Person
  │
  │ inheritance
  ▼
object
```

라는 구조가 존재한다.

여기서 `object`와 `type`을 단순히 외우는 것이 중요한 것은 아니다.

이 구조가 보여주는 더 중요한 특징은 **Python이 Instance와 Class를 완전히 별개의 세계로 분리하지 않았다는 것**이다.

각각의 역할과 내부 구조는 다르지만 Instance와 Class 모두 Python Runtime에서 실제 객체로 존재한다.

_그 결과 Class 역시 이름에 Binding되고, 다른 코드에 전달되고, 실행 중에 선택되고, 필요하다면 동적으로 구성될 수 있다._

즉,

> **Python에서 "Class도 객체다"라는 말의 핵심은 Class 역시 Python Runtime의 객체 모델 안에서 다룰 수 있는 대상이라는 것이다.**

여기까지 이해하면 자연스럽게 다음 단계로 넘어갈 수 있다.

```python
class Person:
    name = "shin"

p = Person()
p.age = 30
```

지금까지 살펴본 것처럼 `Person`도 객체이고 `p`도 객체다.

그런데 두 객체에는 각각 `name`과 `age`라는 Attribute가 연결되어 있다.

**그렇다면 이 Attribute들은 실제로 어디에 저장되는 걸까?**

`Person.name`과 `p.age`는 같은 곳에 저장될까?

그리고 우리가

```python
p.name
```

이라고 했을 때 Python은 어디에서 `name`을 찾아오는 걸까?

다음 글에서는 Class와 Instance의 객체 구조에서 한 단계 더 들어가, **Attribute가 실제로 어디에 저장되는지** 살펴본다.

---
**다음 글 : 05. Attribute는 어디에 저장되는가**