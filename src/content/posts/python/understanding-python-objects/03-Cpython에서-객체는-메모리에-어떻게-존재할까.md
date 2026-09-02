---
title: "03. CPython에서 객체는 메모리에 어떻게 존재할까"
description: "Python의 객체가 CPython의 메모리에서 어떻게 표현되는지 살펴보고, PyObject와 PyObject *, ob_refcnt, ob_type을 통해 서로 다른 객체를 하나의 객체 모델로 다루는 구조를 이해합니다."
pubDatetime: 2026-09-02T23:20:00+09:00
tags:
  - Python
  - 파이썬 객체에 대한 이해
  - CPython
  - PyObject
draft: false
---

앞선 글에서는 Python의 변수와 객체가 어떤 관계를 가지는지 살펴봤다.

```python
a = 10
b = a
```

이 코드를 다음과 같이 이해했다.

```text
a ───┐
     ├────→ 10
b ───┘
```

`a`와 `b`라는 두 이름이 각각 값을 가지고 있는 것이 아니라, 하나의 `10` 객체를 함께 가리키고 있다.

Python의 관점에서는 여기까지만 알아도 충분하다.

하지만 한 단계 더 내려가 보면 새로운 질문이 생긴다.

> **그렇다면 CPython은 이 '객체를 가리킨다'는 개념을 실제 메모리에서 어떻게 구현하고 있을까?**

이번 글에서는 Python이라는 언어의 개념에서 조금 내려가, Python의 대표적인 구현체인 **CPython 내부에서 객체가 어떻게 표현되는지** 살펴본다.

---

## 1. Python과 CPython은 같은 것이 아니다

먼저 구분해야 할 것이 있다.

**Python과 CPython은 정확히 같은 말이 아니다.**

Python은 우리가 사용하는 언어의 문법과 동작을 정의한다.

```python
a = 10
print(type(a))
```

반면 CPython은 이러한 Python 코드를 실제 컴퓨터에서 실행하는 **Python 구현체**다.

즉,

```text
Python
 └─ 언어의 규칙과 의미

CPython
 └─ 그 규칙을 C로 구현한 프로그램
```

이라고 생각할 수 있다.

우리가 일반적으로 설치해서 사용하는 Python은 대부분 CPython이고, CPython은 이름 그대로 상당 부분이 C로 구현되어 있다.

따라서

> **Python에서 모든 것은 객체다.**

라는 언어의 개념이 실제 컴퓨터의 메모리에서는 어떻게 구현되는지 알고 싶다면 CPython의 구현을 바라볼 필요가 있다.

---

## 2. 모든 객체의 공통 기반, `PyObject`

Python에는 다양한 종류의 객체가 존재한다.

```python
10
"hello"
[1, 2, 3]

def hello():
    pass

class Person:
    pass
```

정수, 문자열, 리스트뿐만 아니라 함수와 클래스도 객체다.

하지만 이 객체들이 실제로 가지고 있어야 하는 데이터는 서로 다르다.

정수 객체는 숫자를 표현하기 위한 데이터가 필요하고,

```text
10
```

리스트 객체는 여러 객체를 관리하기 위한 정보가 필요하며,

```text
[1, 2, 3]
```

함수 객체는 실행할 코드나 전역 Namespace 같은 정보를 가지고 있어야 한다.

그런데 이렇게 내부 구조가 서로 다른 객체들을 모두 **Python Object**라는 하나의 모델로 다루려면 공통적인 기반이 필요하다.

CPython에서 그 역할을 하는 것이 `PyObject`다.

개념적으로 단순화하면 `PyObject`는 다음과 같은 구조를 가진다.

```c
struct _object {
    Py_ssize_t ob_refcnt;
    PyTypeObject *ob_type;
};
```

핵심은 두 가지다.

```text
PyObject
├── ob_refcnt
└── ob_type
```

`ob_type`은

> **이 객체는 어떤 타입인가?**

를 나타내기 위한 정보다.

그리고 `ob_refcnt`는 CPython이 객체에 대한 **Reference Count**를 관리하기 위해 사용하는 정보다.

지금은 `ob_refcnt`가 객체의 참조 관리에 사용된다는 정도만 알고 넘어가도 충분하다.

Reference가 증가하고 감소할 때 이 값이 실제로 어떻게 사용되는지, 객체는 언제 메모리에서 제거되는지, 순환 참조와 Garbage Collector는 왜 필요한지는 마지막 **08. 객체는 메모리에서 언제 사라지는가?** 에서 다시 살펴본다.

이번 글에서 중요한 것은 이 두 필드의 세부 동작보다,

> **서로 다른 Python 객체들이 객체로서 필요한 공통적인 정보를 가지고 시작한다.**

는 점이다.

---

## 3. `PyObject`는 객체 전체가 아니다

여기서 한 가지 주의해야 한다.

`PyObject`가 Python 객체의 모든 데이터를 저장하고 있는 것은 아니다.

앞에서 살펴본 `PyObject`에는 다음 정보밖에 없었다.

```text
PyObject
├── ob_refcnt
└── ob_type
```

그런데 정수 객체라면 당연히 `10`이라는 숫자를 표현하기 위한 데이터도 필요하다.

```python
a = 10
```

마찬가지로 리스트라면 요소들을 관리하기 위한 정보가 필요하다.

```python
items = [1, 2, 3]
```

그래서 CPython에서는 객체의 종류에 따라 **자신에게 필요한 데이터를 추가로 가지는 구조체**를 사용한다.

정수 객체를 아주 단순화해서 표현하면 다음과 같이 생각할 수 있다.

```text
Python int object

┌─────────────────────────┐
│ 공통 Object 정보        │
│                         │
│ ob_refcnt               │
│ ob_type                 │
├─────────────────────────┤
│ 정수 표현에 필요한 데이터 │
└─────────────────────────┘
```

리스트 객체는 또 다른 데이터를 가진다.

```text
Python list object

┌─────────────────────────┐
│ 공통 Object 정보        │
│                         │
│ ob_refcnt               │
│ ob_type                 │
├─────────────────────────┤
│ 리스트 길이 / 용량 정보 │
│ 요소들을 가리키는 정보  │
│ ...                     │
└─────────────────────────┘
```

함수 객체 역시 마찬가지다.

```text
Python function object

┌─────────────────────────┐
│ 공통 Object 정보        │
│                         │
│ ob_refcnt               │
│ ob_type                 │
├─────────────────────────┤
│ code                    │
│ globals                 │
│ defaults                │
│ closure                 │
│ ...                     │
└─────────────────────────┘
```

실제 CPython의 구조는 이보다 복잡하지만 여기서 중요한 원리는 단순하다.

> **서로 다른 Python 객체는 서로 다른 데이터를 가지지만, 객체로서 필요한 공통적인 기반을 공유한다.**

그리고 그 공통 기반의 출발점이 `PyObject`다.

---

## 4. 그렇다면 `PyObject *`는 무엇일까?

02편에서 다음과 같은 이야기를 했다.

```python
a = 10
```

Python의 관점에서는 이를 다음과 같이 생각할 수 있었다.

```text
a ─────→ 10 객체
```

이제 CPython 구현 관점으로 한 단계 내려가 보자.

C에서는 메모리에 존재하는 데이터를 가리키기 위해 **Pointer**를 사용한다.

`PyObject`를 가리키는 Pointer는 다음과 같이 표현한다.

```c
PyObject *
```

여기서 둘을 구분해야 한다.

```text
PyObject
```

는 Python 객체가 공통적으로 가지는 **구조의 타입**을 나타내고,

```text
PyObject *
```

는 그러한 Python 객체가 존재하는 **메모리 위치를 가리킬 수 있는 Pointer Type**을 의미한다.

개념적으로 보면 다음과 같다.

```text
PyObject *
    │
    │ pointer
    ▼
┌─────────────────────────┐
│ Python Object           │
│                         │
│ ob_refcnt               │
│ ob_type                 │
│ ...                     │
│ 실제 객체 데이터        │
└─────────────────────────┘
```

따라서 Python에서

```python
a = 10
```

이라는 코드가 있을 때 우리가 언어 수준에서 생각했던

```text
a ─────→ 10 객체
```

라는 관계는 CPython 구현 수준으로 내려가면 객체에 대한 참조를 C의 Pointer를 이용해 다루는 구조와 연결된다.

```text
Python

a ── reference ──→ 10 object


        ↓ CPython에서 구현


CPython

PyObject *
    │
    ▼
┌─────────────────────┐
│ int object: 10      │
│                     │
│ ob_refcnt           │
│ ob_type             │
│ integer data        │
└─────────────────────┘
```

다만 여기서 한 가지는 정확히 구분해야 한다.

Python 언어 차원에서

> **변수는 Pointer다.**

라고 말하는 것은 정확하지 않다.

Python의 변수는 **객체에 Binding된 이름**이다.

`PyObject *`는 이러한 Python의 객체 참조를 CPython이 C 수준에서 구현하고 다룰 때 등장하는 핵심적인 표현이다.

```text
Python의 개념

name ── binding/reference ──→ object


              ↓ 구현


CPython

        PyObject * ─────────→ object memory
```

즉 **언어의 개념과 구현 방법을 구분해서 보는 것**이 중요하다.

---

## 5. `ob_type`은 객체의 Type을 가리킨다

이제 `PyObject`의 `ob_type`을 조금만 더 살펴보자.

```c
PyTypeObject *ob_type;
```

`ob_type`은 이 객체가 **어떤 타입의 객체인지**를 나타내기 위한 Pointer다.

예를 들어,

```python
a = 10
```

에서 `10`은 `int` 타입의 객체다.

```python
type(a)
```

```text
<class 'int'>
```

CPython 내부에서도 `10`이라는 객체는 자신의 Type과 연결되어 있다.

개념적으로 보면 다음과 같다.

```text
a
│
▼
┌─────────────────────┐
│ int object: 10      │
│                     │
│ ob_refcnt           │
│ ob_type ────────────────┐
│ integer data        │   │
└─────────────────────┘   │
                          ▼
                    ┌─────────────┐
                    │ int type    │
                    └─────────────┘
```

즉 객체의 실제 데이터와 함께,

> **나는 어떤 종류의 객체인가?**

를 알 수 있는 정보가 객체의 공통 구조 안에 존재하는 것이다.

여기서는 `int type`의 내부 구조까지 들어가지 않는다.

_지금 중요한 것은 모든 Python 객체가 자신의 Type과 연결될 수 있도록 `ob_type`이라는 공통적인 정보를 가지고 있다는 점이다._

---

## 6. 서로 다른 객체를 어떻게 `PyObject *`로 다룰 수 있을까?

여기서 `PyObject`가 왜 필요한지 조금 더 분명해진다.

정수와 리스트의 실제 메모리 구조는 서로 다르다.

```text
int object

┌──────────────────────┐
│ ob_refcnt            │
│ ob_type              │
├──────────────────────┤
│ integer data         │
└──────────────────────┘


list object

┌──────────────────────┐
│ ob_refcnt            │
│ ob_type              │
├──────────────────────┤
│ list size            │
│ elements pointer     │
│ ...                  │
└──────────────────────┘
```

그런데 두 객체 모두 시작 부분에 객체로서 필요한 공통적인 구조를 가지고 있다.

```text
                공통 Object 구조
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼

        int object          list object

     ┌──────────────┐     ┌──────────────┐
     │ ob_refcnt    │     │ ob_refcnt    │
     │ ob_type      │     │ ob_type      │
     ├──────────────┤     ├──────────────┤
     │ integer data │     │ list data    │
     └──────────────┘     └──────────────┘
```

따라서 CPython은 객체의 구체적인 종류를 당장 알 필요가 없는 상황에서는 이들을 공통적으로 **`PyObject *`라는 관점에서 다룰 수 있다.**

```text
                    PyObject *
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    int object      list object    function object
```

하지만 실제 정수 연산이나 리스트 연산처럼 특정 객체의 고유한 데이터가 필요해지면 각 객체의 구체적인 구조를 이용해야 한다.

즉 CPython에는 크게 두 가지 관점이 존재한다고 볼 수 있다.

```text
공통적으로 다룰 때

PyObject *
    │
    └──→ "하나의 Python Object"


구체적인 동작이 필요할 때

int object
    └──→ 정수 데이터와 정수 연산

list object
    └──→ 요소 정보와 리스트 연산

function object
    └──→ Code, Globals, Closure ...
```

이 구조 덕분에 객체마다 내부 데이터가 완전히 달라도 CPython은 이들을 모두 **Python Object라는 공통적인 관점**에서 다룰 수 있다.

---

## 7. Python의 객체 모델이 CPython 구현과 만나는 지점

이제 01편부터 이야기했던 내용을 CPython의 구현과 연결할 수 있다.

Python에는 서로 전혀 다른 종류의 값들이 존재한다.

```python
10
"hello"
[1, 2, 3]

def hello():
    pass

class Person:
    pass
```

정수와 리스트의 내부 구조는 다르고,

함수와 정수의 내부 구조는 더더욱 다르다.

그런데 Python은 이들을 모두 **객체라는 하나의 모델**로 다룬다.

```text
int
str
list
function
class
   │
   ▼
 object
```

그렇다면 Python을 구현하는 CPython 역시 서로 다른 구조를 가진 값들을 공통적으로 다룰 방법이 필요하다.

그 역할의 중심에 `PyObject`와 `PyObject *`가 있다.

```text
                     PyObject *
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
     int object      list object    function object
          │              │              │
          ▼              ▼              ▼
     정수 데이터      리스트 데이터      함수 데이터
```

각 객체가 가지고 있는 실제 데이터는 서로 다르다.

하지만 객체로서 필요한 공통적인 정보를 가지도록 구조를 맞춰두었기 때문에 CPython은 이들을 공통적인 객체 인터페이스를 통해 다룰 수 있다.

즉,

```text
Python의 언어 모델

"모든 것은 객체다."
        │
        ▼
서로 다른 값을 하나의 Object Model로 다룬다.


             ↓ CPython에서 구현


CPython의 객체 표현

PyObject / PyObject *
        │
        ▼
공통 Object 구조 + Type별 데이터
```

이 지점에서 Python의 **"모든 것은 객체다"** 라는 언어 모델과 CPython의 실제 구현 방식이 연결된다.

---

## 8. 정리

02편에서 우리는 Python의 변수를 다음과 같이 이해했다.

```text
name ─────→ object
```

변수는 값을 담는 상자가 아니라 객체에 Binding되는 이름이다.

이번 글에서는 여기서 한 단계 더 내려가 그 객체가 CPython에서는 어떻게 표현되는지 살펴봤다.

CPython의 객체들은 서로 다른 실제 데이터를 가진다.

```text
int object
 └── integer data

list object
 └── list data

function object
 └── function data
```

하지만 동시에 객체로서 필요한 공통적인 구조를 가진다.

```text
Python Object

┌──────────────────────┐
│ ob_refcnt            │
│ ob_type              │
├──────────────────────┤
│ Type-specific data   │
└──────────────────────┘
```

그리고 CPython은 이러한 Python 객체를 다룰 때 `PyObject *`라는 공통적인 Pointer Type을 광범위하게 사용한다.

```text
                  PyObject *
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        int          list        function
```

즉 서로 다른 Python 객체의 실제 메모리 구조는 모두 다르지만,

**CPython은 객체들이 공통적인 기반을 가지도록 만들고 이를 공통된 객체 관점에서 다룰 수 있도록 구현한다.**

이것이 Python의

> **Everything in Python is an object.**

라는 개념이 CPython의 구현과 만나는 중요한 지점이다.

그런데 아직 한 가지가 남아 있다.

앞에서 `10`이라는 객체는 `ob_type`을 통해 자신의 Type과 연결된다고 했다.

```text
┌─────────────────────┐
│ int object: 10      │
│                     │
│ ob_type ────────────────→ int
└─────────────────────┘
```

그렇다면 여기서 `ob_type`이 가리키고 있는 **`int` 자체는 무엇일까?**

Python에서는 `int`를 직접 변수에 저장하거나 함수에 전달할 수도 있다.

우리가 직접 만드는 `Person` 같은 Class도 마찬가지다.

```python
class Person:
    pass
```

그렇다면 객체의 Type을 정의하는 **Class 자체도 하나의 객체일까?**

그리고 그렇다면 그 Class Object는 어떻게 만들어지는 걸까?

다음 글에서는 여기서 객체 모델을 한 단계 확장해, **04. Class는 어떻게 객체가 되는가** 를 살펴본다.

---
**다음 글: 04. Class는 어떻게 객체가 되는가**
