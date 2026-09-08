---
title: "05. Python에서 함수 호출은 내부적으로 어떻게 이루어지는가"

description: "Python의 함수 호출이 Function Object 탐색과 argument binding을 거쳐 새로운 실행 상태를 만들고, Bytecode 실행과 return을 통해 다시 호출자로 돌아가는 과정을 이해합니다."

pubDatetime: 2026-09-08T14:10:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - 함수 호출
  - Function Object
  - argument binding
  - Frame

draft: false
---

Python에서 함수를 호출하는 것은 겉으로 보면 매우 단순하다.

```python
def add(a, b):
    return a + b

result = add(10, 20)
```

우리가 보는 것은 단지 `add(10, 20)`이라는 코드다.

하지만 Python 내부에서는 단순히 함수의 코드가 있는 곳으로 이동해서 실행하는 것이 아니다.

먼저 `add`가 가리키는 함수 객체를 찾고, 전달된 argument를 parameter에 연결한 뒤, 새로운 함수 실행을 준비해야 한다.

그리고 함수 실행이 끝나면 결과와 실행 제어권을 다시 호출한 쪽으로 돌려줘야 한다.

전체 흐름을 단순화하면 다음과 같다.

```text
             add(10, 20)
                  │
                  ▼
          Function Object
             │        │
             │        └── globals
             │
             └── Code Object
                  │
arguments ────────┤
  10, 20          │
                  ▼
          argument binding
                  │
                  ▼
           함수 실행 준비
                  │
                  ▼
          Bytecode execution
                  │
                  ▼
               return
                  │
                  ▼
              caller
```

이번 글에서는 Python이 `add(10, 20)`이라는 함수 호출을 만나고, 다시 호출한 코드로 돌아오기까지 어떤 과정이 일어나는지 살펴본다.

---

## 1. 함수는 코드 그 자체가 아니다

먼저 다음 코드를 생각해보자.

```python
def add(a, b):
    return a + b
```

`def`가 실행되면 Python은 단순히 `add`라는 코드 영역을 만들어두는 것이 아니다.

함수 객체(Function Object)가 만들어지고 `add`라는 이름이 그 객체를 가리키게 된다.

```python
print(add)
print(type(add))
```

대략 다음과 같은 결과를 볼 수 있다.

```text
<function add at 0x...>
<class 'function'>
```

즉 다음과 같은 관계가 만들어진다.

```text
add
 │
 ▼
Function Object
```

그리고 Function Object는 자신이 실행해야 할 Code Object를 참조한다.

```python
print(add.__code__)
```

```text
<code object add at 0x...>
```

따라서 조금 더 자세히 표현하면 다음과 같다.

```text
add
 │
 ▼
Function Object
 │
 └── Code Object
```

여기서 중요한 것은 **Function Object와 Code Object가 서로 다른 객체**라는 점이다.

Code Object가 실행할 코드의 정보를 담고 있다면, Function Object는 그 코드를 실제 Python 환경에서 **호출 가능한 함수로 묶어놓은 객체**라고 볼 수 있다.

---

## 2. Function Object는 Code Object만 가지고 있지 않다

앞선 글에서 Code Object에는 Bytecode를 비롯하여 코드 실행에 필요한 여러 정보가 들어 있다는 것을 살펴봤다.

예를 들어 다음과 같은 정보를 확인할 수 있다.

```python
print(add.__code__.co_varnames)
print(add.__code__.co_consts)
print(add.__code__.co_code)
```

`dis`를 사용하면 Bytecode도 확인할 수 있다.

```python
import dis

dis.dis(add)
```

개념적으로 Code Object는 다음과 같은 정보를 가진다.

```text
Code Object
├── Bytecode
├── constants
├── local variable names
├── argument information
└── 기타 코드 관련 정보
```

하지만 함수를 실제로 호출하려면 코드만으로는 부족하다.

예를 들어 함수 안에서 다음과 같이 전역 변수를 사용할 수도 있다.

```python
x = 10

def add_x(n):
    return n + x
```

`add_x()`를 실행하려면 Code Object뿐 아니라 `x`를 어디에서 찾아야 하는지도 알아야 한다.

Function Object는 이러한 실행 환경과 관련된 정보도 함께 가지고 있다.

개념적으로 보면 다음과 같다.

```text
Function Object
├── Code Object
├── globals
├── default arguments
├── closure
├── annotations
└── 기타 함수 상태
```

실제로 일부 정보는 다음과 같이 확인할 수 있다.

```python
print(add.__code__)
print(add.__globals__)
print(add.__defaults__)
```

따라서 두 객체의 역할을 간단히 구분하면 다음과 같다.

```text
Code Object
    → 무엇을 실행할 것인가

Function Object
    → 그 코드를 어떤 환경과 함께
      호출 가능한 함수로 사용할 것인가
```

이제 이 Function Object가 실제로 호출되면 어떤 일이 일어나는지 살펴보자.

---

## 3. `add(10, 20)`을 만나면 무슨 일이 일어날까?

다음 호출을 생각해보자.

```python
result = add(10, 20)
```

Interpreter는 먼저 호출할 대상을 알아야 한다.

`add`라는 이름을 찾으면 그 이름은 앞에서 만들어진 Function Object를 가리키고 있다.

```text
add
 │
 ▼
Function Object
```

그리고 호출 표현식에 들어 있는 argument도 평가한다.

```text
add(10, 20)
    │   │
    │   └── 20
    └────── 10
```

이 예제에서는 단순히 `10`, `20`이지만 argument에는 다른 표현식이 들어갈 수도 있다.

```python
add(1 + 2, 3 * 4)
```

이 경우에는 먼저 각각의 표현식을 평가하여 실제로 전달할 객체를 얻는다.

```text
1 + 2 → 3
3 * 4 → 12

        ↓

add(3, 12)
```

즉 함수 호출에는 크게 두 종류의 정보가 만난다.

```text
Function Object
    → 어떤 함수를 호출할 것인가

arguments
    → 이번 호출에 어떤 값을 전달할 것인가
```

이제 Python은 이 둘을 바탕으로 실제 함수 실행을 준비한다.

그 과정에서 중요한 것이 **argument binding**이다.

---

## 4. argument는 parameter에 어떻게 연결되는가?

함수를 정의할 때는 parameter를 작성한다.

```python
def add(a, b):
    return a + b
```

함수를 호출할 때는 argument를 전달한다.

```python
add(10, 20)
```

Python은 호출 과정에서 전달받은 argument를 함수가 정의한 parameter 구조에 맞게 연결해야 한다.

```text
argument       parameter

   10    ───────→ a
   20    ───────→ b
```

결과적으로 이번 함수 실행에서는 다음과 같은 관계가 필요하다.

```text
a → 10
b → 20
```

단순한 positional argument만 존재하는 것은 아니다.

다음 함수를 생각해보자.

```python
def func(a, b=10, *args, **kwargs):
    ...
```

그리고 다음과 같이 호출한다.

```python
func(1, 20, 30, 40, x=50)
```

전달된 argument들은 함수의 parameter 구조에 맞게 처리된다.

개념적으로는 다음과 같다.

```text
a       → 1
b       → 20
args    → (30, 40)
kwargs  → {"x": 50}
```

keyword argument도 마찬가지다.

```python
add(b=20, a=10)
```

호출 순서는 다르지만 parameter 이름을 기준으로 연결할 수 있다.

```text
a → 10
b → 20
```

default parameter가 있다면 전달되지 않은 값을 기본값으로 채울 수도 있다.

```python
def greet(name, message="Hello"):
    ...
```

```python
greet("Python")
```

```text
name    → "Python"
message → "Hello"
```

반대로 함수가 요구하는 parameter를 채울 수 없다면 정상적인 함수 실행을 시작할 수 없다.

```python
def add(a, b):
    return a + b

add(10)
```

```text
TypeError: add() missing 1 required positional argument: 'b'
```

즉 함수 호출은 단순히 전달된 값을 순서대로 넣는 것이 아니라,

> **함수가 정의한 parameter 구조와 실제 호출에서 전달된 argument를 연결하는 과정**

을 필요로 한다.

---

## 5. argument binding이 끝나면 새로운 함수 실행이 시작된다

argument가 parameter에 정상적으로 연결되었다면 이제 함수의 코드를 실행할 수 있다.

앞선 04편에서 살펴본 것처럼 Python은 코드를 실행할 때 **Frame이라는 실행 상태**를 사용한다.

따라서 `add(10, 20)`이라는 호출도 이번 함수 실행을 위한 새로운 실행 상태를 필요로 한다.

```text
            add(10, 20)
                 │
                 ▼
         Function Object
            │        │
            │        └── globals
            │
            └── Code Object

        arguments
          10, 20
             │
             ▼
      argument binding
             │
        a = 10
        b = 20
             │
             ▼
      새로운 함수 실행
           (Frame)
             │
             ▼
      Bytecode execution
```

Frame의 내부 구조는 앞선 글에서 자세히 살펴봤으므로 여기서는 다시 다루지 않는다.

이번 글에서 중요한 것은 **함수 호출 하나가 하나의 새로운 함수 실행을 만든다는 것**이다.

같은 함수를 여러 번 호출하더라도 각각의 호출은 서로 독립적인 실행 상태를 가진다.

```python
add(1, 2)
add(10, 20)
```

두 호출은 같은 Function Object와 Code Object를 사용하지만 각각 별도의 실행으로 처리된다.

```text
             Function Object
                    │
               Code Object
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
       호출 1               호출 2
       Frame A              Frame B
       a = 1                a = 10
       b = 2                b = 20
```

즉,

> **함수와 함수의 실행은 서로 다른 개념이다.**

Function Object는 계속 존재할 수 있지만, 함수 실행은 호출될 때마다 새롭게 만들어지고 끝나면 종료된다.

---

## 6. 실행이 시작되면 Bytecode가 처리된다

함수 실행이 준비되면 Interpreter는 Frame이 참조하는 Code Object의 Bytecode를 실행한다.

```python
def add(a, b):
    return a + b
```

개념적으로는 다음과 같은 작업이 이루어진다.

```text
a를 가져온다
    ↓
b를 가져온다
    ↓
두 객체를 더한다
    ↓
결과를 반환한다
```

여기서 중요한 점은 **Function Object 자체가 Bytecode를 실행하는 것은 아니라는 것**이다.

Function Object는 호출에 필요한 코드와 실행 환경을 제공한다.

그리고 실제 실행에서는 Interpreter가 이번 호출을 위해 준비된 실행 상태를 사용하여 Bytecode를 처리한다.

따라서 지금까지의 흐름은 다음과 같이 정리할 수 있다.

```text
Function Object
      │
      ▼
arguments 처리
      │
      ▼
argument binding
      │
      ▼
함수 실행 상태 준비
      │
      ▼
Interpreter
      │
      ▼
Bytecode execution
```

그런데 함수가 실행되는 동안 또 다른 함수를 호출하면 어떻게 될까?

---

## 7. 함수 안에서 다른 함수를 호출하면 어떻게 될까?

다음 코드를 보자.

```python
def add(a, b):
    return a + b

def calculate():
    x = add(10, 20)
    return x

calculate()
```

먼저 `calculate()`가 호출된다.

따라서 `calculate`를 위한 함수 실행이 시작된다.

```text
calculate Frame
```

Interpreter가 `calculate`의 Bytecode를 실행하다 보면 다음 호출을 만나게 된다.

```python
add(10, 20)
```

이제 `add()` 역시 하나의 새로운 함수 호출이다.

따라서 `add`를 위한 새로운 실행이 시작된다.

```text
calculate Frame
      │
      │ add(10, 20)
      ▼
   add Frame
```

여기서 중요한 점이 있다.

`add()`를 실행한다고 해서 기존의 `calculate()` 실행이 사라지는 것은 아니다.

`add()`가 끝난 뒤에는 다시 `calculate()`로 돌아와 다음 코드를 계속 실행해야 하기 때문이다.

```python
x = add(10, 20)
return x
```

따라서 실행 흐름을 개념적으로 보면 다음과 같다.

```text
calculate Frame
      │
      │ add(10, 20) 호출
      ▼
   add Frame
      │
      │ 실행
      │
      │ return 30
      ▼
calculate Frame
      │
      │ x = 30
      ▼
   계속 실행
```

여기서 `calculate`는 **호출한 쪽**(caller)이고, `add`는 **호출된 쪽**(callee)이다.

```text
caller                 callee

calculate ───────────→ add
          function call

calculate ←─────────── add
             return
```

즉 함수 호출은 단순히 새로운 함수를 실행하는 것뿐 아니라 **실행 제어권이 caller에서 callee로 이동하는 과정**이기도 하다.

---

## 8. `return`은 값과 제어권을 호출자에게 돌려준다

우리는 보통 `return`을 다음과 같이 이해한다.

```python
return a + b
```

> 함수의 결과를 반환한다.

물론 맞는 설명이다.

하지만 함수 호출의 실행 흐름에서 보면 한 가지 의미가 더 있다.

`return`은 **현재 함수 실행을 끝내고 실행 제어권을 호출자에게 돌려준다.**

다시 다음 코드를 보자.

```python
def add(a, b):
    return a + b

def calculate():
    result = add(10, 20)
    return result
```

`calculate()`가 실행되다가 `add()`를 호출하면 실행 제어권이 `add`로 이동한다.

```text
calculate
    │
    │ add(10, 20)
    ▼
   add
```

그리고 `add`가

```python
return a + b
```

를 실행하면 `30`이라는 결과와 함께 실행 제어권이 다시 `calculate`로 돌아온다.

```text
calculate Frame
      │
      │ add(10, 20)
      ▼
   add Frame
      │
      │ return 30
      ▼
calculate Frame
      │
      │ result = 30
      ▼
   계속 실행
```

따라서 `return`은 함수 호출 관점에서 다음 두 가지 역할을 한다고 볼 수 있다.

```text
return
│
├── 결과를 호출자에게 전달
│
└── 현재 함수 실행을 종료하고
    호출자에게 제어권을 돌려줌
```

명시적인 `return`이 없는 함수도 호출자에게 돌아가야 한다.

이 경우 Python 함수는 `None`을 반환한다.

```python
def hello():
    print("hello")

result = hello()

print(result)
```

```text
hello
None
```

결국 함수 호출은 **호출 → 실행 → 복귀**라는 하나의 흐름을 가진다.

```text
caller
   │
   │ call
   ▼
callee
   │
   │ return
   ▼
caller
```

---

## 9. 여러 함수가 중첩해서 호출될 수도 있다

함수 호출은 두 단계에서 끝날 필요가 없다.

```python
def c():
    return 10

def b():
    return c()

def a():
    return b()

a()
```

실행은 다음과 같이 점점 안쪽으로 들어간다.

```text
a Frame
   │
   │ b()
   ▼
b Frame
   │
   │ c()
   ▼
c Frame
```

그리고 `c()`가 끝나면 반대 방향으로 돌아온다.

```text
c Frame
   │
   │ return 10
   ▼
b Frame
   │
   │ return 10
   ▼
a Frame
   │
   │ return 10
   ▼
호출한 코드
```

안쪽 함수가 실행되는 동안 바깥쪽 함수의 실행 상태는 없어지는 것이 아니라, **나중에 다시 이어서 실행할 수 있도록 유지된다.**

이것이 여러 단계의 함수 호출이 가능한 이유다.

---

## 10. 재귀 호출도 같은 원리다

이 구조를 이해하면 재귀 함수도 특별한 방식으로 실행되는 것이 아니라는 것을 알 수 있다.

```python
def factorial(n):
    if n == 1:
        return 1

    return n * factorial(n - 1)
```

다음과 같이 호출해보자.

```python
factorial(3)
```

처음에는 `factorial(3)`의 실행이 시작된다.

```text
factorial(3)
```

그런데 실행 중 다시 같은 함수를 호출한다.

```text
factorial(3)
      │
      │ factorial(2)
      ▼
factorial(2)
```

그리고 다시 호출한다.

```text
factorial(3)
      │
      ▼
factorial(2)
      │
      ▼
factorial(1)
```

같은 Function Object를 호출하고 같은 Code Object를 실행하지만 **각각은 서로 다른 함수 호출**이다.

따라서 각각 독립적인 실행 상태를 가진다.

```text
factorial(3) Frame → n = 3
        │
        ▼
factorial(2) Frame → n = 2
        │
        ▼
factorial(1) Frame → n = 1
```

가장 안쪽의 `factorial(1)`이 값을 반환하면 실행 제어권은 호출했던 함수로 돌아간다.

```text
factorial(1)
    │
    └── return 1
          │
          ▼
factorial(2)
    │
    └── 2 * 1
          │
          └── return 2
                    │
                    ▼
factorial(3)
    │
    └── 3 * 2
          │
          └── return 6
```

즉 재귀 호출 역시 본질적으로는 지금까지 살펴본 함수 호출과 같다.

> **같은 함수를 다시 호출하면서 새로운 함수 실행을 만들고, 가장 안쪽 실행부터 차례대로 반환하는 과정이다.**

---

## 11. 함수 호출의 전체 흐름을 연결해보자

이제 `add(10, 20)`이라는 짧은 코드 안에서 어떤 일이 일어나는지 하나로 연결해볼 수 있다.

먼저 함수가 정의된다.

```python
def add(a, b):
    return a + b
```

`def`가 실행되면서 Function Object가 만들어지고 `add`라는 이름에 연결된다.

```text
add
 │
 ▼
Function Object
 │
 ├── Code Object
 ├── globals
 ├── defaults
 └── ...
```

이제 다음 호출을 만난다.

```python
result = add(10, 20)
```

그러면 개념적인 실행 흐름은 다음과 같다.

```text
add(10, 20)
     │
     ▼
add 이름 탐색
     │
     ▼
Function Object
     │
     ▼
arguments 평가
     │
     │ 10, 20
     ▼
argument binding
     │
     │ a = 10
     │ b = 20
     ▼
새로운 함수 실행 준비
     │
     │ Frame
     ▼
Bytecode execution
     │
     ▼
return 30
     │
     ▼
caller로 복귀
     │
     ▼
result = 30
```

여기서 각각의 역할을 구분하면 다음과 같다.

```text
Function Object
    → 호출 가능한 함수 자체

Code Object
    → 함수가 실행할 코드

arguments
    → 이번 호출에서 전달되는 값

argument binding
    → argument와 parameter를 연결하는 과정

Frame
    → 이번 함수 호출의 실행 상태

Interpreter
    → Frame의 상태를 사용해 Bytecode를 실행

return
    → 결과와 실행 제어권을 호출자에게 돌려줌
```

결국 Python에서 함수 호출은 단순히 **함수의 코드가 있는 곳으로 이동하는 것**이 아니다.

> **Function Object와 전달된 argument를 바탕으로 새로운 함수 실행을 준비하고, Interpreter가 그 실행 상태에서 Bytecode를 처리한 뒤 결과와 제어권을 호출자에게 돌려주는 과정이다.**

그리고 함수 호출이 중첩되더라도 같은 원리가 반복된다.

```text
caller
   │
   │ call
   ▼
callee
   │
   │ call
   ▼
another callee
   │
   │ return
   ▼
callee
   │
   │ return
   ▼
caller
```

이제 여기서 한 단계 더 나아갈 수 있다.

일반적인 함수는 호출되면 실행을 시작하고, `return`을 만나면 현재 함수 실행이 끝난다.

그런데 Python에는 **실행을 끝내지 않고 중간에 멈춰두었다가 나중에 다시 이어서 실행할 수 있는 구조**도 있다.

그 구조를 이해하기 전에 먼저 Python의 반복이 어떤 규칙으로 이루어지는지 살펴볼 필요가 있다.

다음 글에서는 **Iterable과 Iterator, 그리고 `iter()`와 `next()`가 어떻게 Python의 반복을 가능하게 하는지** 살펴본다.

---
**다음 글 : 06 Iterator는 반복을 어떻게 가능하게 하는가**
