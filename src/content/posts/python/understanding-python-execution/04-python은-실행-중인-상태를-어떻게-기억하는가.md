---
title: "04. Python은 실행 중인 상태를 어떻게 기억하는가"

description: "Python이 Frame을 통해 실행 중인 상태를 관리하는 방식을 살펴보고, Code Object와 Frame의 차이, namespace, Operand Stack, instruction 위치, 함수 호출과 Call Stack의 관계를 이해합니다."

pubDatetime: 2026-09-08T14:08:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Frame
  - Code Object
  - Call Stack

draft: false
---
앞선 글에서는 Python Interpreter가 Code Object 안의 Bytecode를 읽고, Python VM이 Opcode를 하나씩 실행한다는 것을 살펴봤다.

```text
Source Code
    ↓
   AST
    ↓
Code Object
    ↓
Bytecode
    ↓
Python VM
    ↓
Opcode 실행
```

그런데 여기서 한 가지 의문이 생긴다.

다음과 같은 코드가 실행되고 있다고 생각해보자.

```python
def add(a, b):
    result = a + b
    return result

x = add(10, 20)
```

Python은 `add()`를 실행하는 동안 여러 가지 정보를 기억해야 한다.

- `a`가 `10`이라는 것

- `b`가 `20`이라는 것

- `result`라는 지역 변수

- 현재 어느 Bytecode까지 실행했는지

- 연산 도중 만들어지는 중간 값

- 함수 실행이 끝난 뒤 어디로 돌아가야 하는지


Code Object에는 **무엇을 실행할지**가 들어 있지만, 이러한 **현재 실행 상태**까지 들어 있지는 않다.

Python은 이 실행 상태를 **Frame**이라는 객체를 통해 관리한다.

---

## 1. Code Object는 실행 상태가 아니다

02편에서 살펴본 것처럼 Python 코드는 컴파일되면서 Code Object가 된다.

```python
def add(a, b):
    return a + b
```

함수 객체의 `__code__`를 확인하면 해당 함수의 Code Object를 볼 수 있다.

```python
print(add.__code__)
```

Code Object에는 대략 다음과 같은 정보가 들어 있다.

```text
Bytecode
상수
지역 변수 이름
함수의 인자 정보
다른 Code Object
...
```

즉,

> **Code Object는 코드를 어떻게 실행해야 하는지를 표현한다.**

하지만 Code Object만으로는 실제 실행 중인 상태까지 표현할 수 없다.

예를 들어

```python
add(10, 20)
```

이 실행되기 시작하면 다음과 같은 정보가 필요하다.

```text
a = 10
b = 20
현재 실행 위치 = ...
계산 중간값 = ...
```

이 정보들은 코드를 호출할 때마다 달라진다.

같은 함수를 두 번 호출한다고 생각해보자.

```python
add(10, 20)
add(30, 40)
```

두 호출이 실행하는 코드는 동일하다.

따라서 두 실행 모두 같은 Code Object를 사용한다.

하지만 각각의 실행 상태는 다르다.

```text
                    ┌──────────────────┐
                    │   Code Object    │
                    │                  │
                    │ Bytecode         │
                    │ Constants        │
                    │ Variable Names   │
                    └────────▲─────────┘
                             │
                        같은 코드를 참조
                   ┌─────────┴─────────┐
                   │                   │
          ┌────────┴────────┐ ┌────────┴────────┐
          │     Frame 1     │ │     Frame 2     │
          │                 │ │                 │
          │ a = 10          │ │ a = 30          │
          │ b = 20          │ │ b = 40          │
          │ 실행 위치         │ │ 실행 위치        │
          │ 계산 중간값       │ │ 계산 중간값       │
          └─────────────────┘ └─────────────────┘
```

여기서 중요한 점은 **Frame이 Code Object의 복사본이 아니라는 것**이다.

각 Frame은 자신이 실행할 **Code Object를 참조**하면서, 해당 실행에서만 필요한 상태를 별도로 관리한다.

즉 Python은

```text
Code Object
    │
    ├── 코드 자체의 정보
    │
    └── 여러 실행에서 공유
```

와

```text
Frame
    │
    ├── 특정 실행의 상태
    │
    └── 실행할 Code Object를 참조
```

를 구분해서 관리한다.

Code Object가 **실행할 코드의 설계도**라면, Frame은 **그 설계도를 바탕으로 진행되고 있는 하나의 실행 상태**라고 생각할 수 있다.

---

## 2. Frame이란 무엇인가?

Python에서 함수나 코드 블록이 실행될 때 Interpreter는 해당 실행을 위한 **Frame**을 사용한다.

앞에서 본 것처럼 Frame은 Code Object 자체를 새롭게 만드는 것이 아니다.

Frame은 **어떤 Code Object를 실행하고 있는지 참조하면서, 그 실행에 필요한 상태를 관리한다.**

개념적으로 Frame이 관리하는 정보를 나누어 보면 다음과 같다.

```text
Frame
│
├── 어떤 코드를 실행하는가?
│      └── Code Object 참조
│
├── 현재 어떤 값들을 사용하는가?
│      ├── local namespace
│      ├── global namespace
│      └── builtins
│
├── 지금 계산 중인 것은 무엇인가?
│      └── operand stack
│
├── 어디까지 실행했는가?
│      └── instruction pointer
│
└── 어디에서 실행되어 왔는가?
       └── previous frame
```

예를 들어

```python
def add(a, b):
    result = a + b
    return result

add(10, 20)
```

가 실행되고 있다면 `add()`의 실행을 담당하는 Frame을 개념적으로 다음과 같이 생각할 수 있다.

```text
Frame: add
│
├── Code Object 참조
│      └── add.__code__
│
├── Local namespace
│      ├── a = 10
│      ├── b = 20
│      └── result = ...
│
├── Global namespace
│      ├── add = <function add>
│      └── ...
│
├── Builtins
│      └── ...
│
├── Operand Stack
│      └── ...
│
├── Instruction Pointer
│      └── 현재 실행 중인 Bytecode 위치
│
└── Previous Frame
       └── 이 코드를 실행하게 된 이전 Frame
```

즉 하나의 Frame을 간단히 정리하면 다음과 같다.

```text
Frame
=
실행할 Code Object에 대한 참조
+
이번 실행에서만 필요한 상태
```

Python VM은 이 Frame에 연결된 Code Object의 Bytecode를 읽고, **Frame에 저장된 실행 상태를 계속 변경해가며 코드를 실행한다.**

---

## 3. namespace는 현재 이름과 객체의 관계를 기억한다

Frame이 관리해야 하는 가장 중요한 정보 중 하나가 **namespace**다.

우리는 이전 객체 시리즈에서 Python의 변수가 값을 담는 상자라기보다 **이름과 객체의 binding**이라고 살펴봤다.

```python
x = 10
```

개념적으로는

```text
x ─────→ 10
```

이다.

함수 안에서도 마찬가지다.

```python
def calculate(a, b):
    result = a + b
    return result
```

함수가 실행되면 해당 실행의 지역 이름들이 필요하다.

```text
Local namespace

a       → 10
b       → 20
result  → 30
```

그리고 함수 밖의 이름이 필요하면 global namespace를 참조할 수도 있다.

```python
RATE = 0.1

def calculate(price):
    return price * RATE
```

`calculate()`의 Frame에서는 `price`는 지역 이름이지만 `RATE`는 전역 이름이다.

개념적으로는 다음과 같다.

```text
Frame
│
├── locals
│   └── price → 10000
│
└── globals
    └── RATE → 0.1
```

따라서 Frame은 단순히 "함수의 지역 변수 저장소"만을 의미하지 않는다.

**현재 코드를 실행하기 위해 어떤 namespace를 바라봐야 하는지도 실행 상태의 일부다.**

---

## 4. 계산 중간값은 Operand Stack에 저장된다

Frame에는 이름뿐만 아니라 **연산 도중 필요한 중간 값**도 필요하다.

다음 코드를 생각해보자.

```python
result = a + b
```

Python VM은 이것을 한 번에 처리하지 않는다.

Bytecode 수준에서는 개념적으로 다음과 같은 과정이 일어난다.

```text
a를 가져온다
b를 가져온다
더한다
result에 저장한다
```

이때 중간 값을 잠시 보관하는 공간이 필요하다.

이것이 **Operand Stack**이다.

예를 들어 `a = 10`, `b = 20`이라면 실행 과정은 개념적으로 다음과 같다.

```text
LOAD a

Operand Stack
┌────┐
│ 10 │
└────┘
```

다음으로 `b`를 가져온다.

```text
LOAD b

Operand Stack
┌────┐
│ 20 │
├────┤
│ 10 │
└────┘
```

그리고 덧셈 Opcode가 실행된다.

```text
ADD

10 + 20
```

두 값을 Stack에서 꺼내 연산한 뒤 결과를 다시 Stack에 넣는다.

```text
Operand Stack
┌────┐
│ 30 │
└────┘
```

마지막으로 `result`에 저장하면 Stack에서 값이 빠져나간다.

```text
STORE result

Local namespace

result → 30
```

즉 Python VM의 실행을 단순화하면 다음과 같이 볼 수 있다.

```text
Bytecode
   ↓
Operand Stack에서 값 가져오기
   ↓
Opcode 수행
   ↓
결과를 다시 Stack에 저장
```

이 때문에 CPython의 실행 모델을 흔히 **stack-based virtual machine**이라고 설명한다.

여기서 말하는 Stack은 함수 호출 관계를 설명할 때 사용하는 **Call Stack**과 구분할 필요가 있다.

Operand Stack은 **하나의 Frame 내부에서 연산 중간값을 처리하기 위한 Stack**이다.

---

## 5. Python은 현재 어디까지 실행했는지도 기억해야 한다

다음과 같은 코드가 있다고 해보자.

```python
def calculate(a, b):
    x = a + b
    y = x * 2
    return y
```

Python VM은 Bytecode를 순서대로 실행한다.

그렇다면 당연히 다음에 실행해야 할 instruction이 무엇인지 알고 있어야 한다.

```text
instruction 0
instruction 1
instruction 2
instruction 3
...
```

이를 개념적으로 **instruction pointer**라고 생각할 수 있다.

```text
Bytecode

[0] LOAD_FAST ...
[1] LOAD_FAST ...
[2] BINARY_OP ...
[3] STORE_FAST ...
             ↑
       현재 실행 위치
```

하나의 Opcode를 실행하면 현재 실행 위치가 다음 instruction으로 이동한다.

```text
instruction pointer
        ↓
Bytecode → Opcode → Opcode → Opcode → ...
```

물론 조건문이나 반복문이 있다면 항상 바로 다음 instruction으로 이동하는 것은 아니다.

```python
if x > 10:
    ...
```

조건에 따라 특정 Bytecode 위치로 이동할 수도 있다.

```text
        ┌─────────────┐
        │             ▼
Opcode → Opcode → JUMP → Opcode
                  │
                  └────→ Opcode
```

따라서 **현재 어느 instruction을 실행하고 있는가** 역시 중요한 실행 상태다.

---

## 6. 함수가 호출되면 새로운 Frame이 필요하다

Frame의 의미는 함수 호출을 보면 더욱 명확해진다.

```python
def add(a, b):
    return a + b

def calculate():
    x = 10
    y = 20
    return add(x, y)

calculate()
```

먼저 `calculate()`가 실행된다.

```text
Frame: calculate

locals
x → 10
y → 20
```

그런데 실행 도중 `add()`를 호출한다.

```python
add(x, y)
```

`add()`는 자신의 지역 변수와 자신의 실행 위치가 필요하다.

따라서 별도의 실행 상태가 만들어진다.

```text
Frame: calculate
    │
    └── Frame: add
            a → 10
            b → 20
```

`add()`가 실행되는 동안에도 `calculate()`의 상태는 사라지면 안 된다.

왜냐하면 `add()`가 끝난 뒤 다시 `calculate()`의 실행을 이어가야 하기 때문이다.

```text
calculate Frame
    │
    │ add() 호출
    ▼
add Frame
    │
    │ return
    ▼
calculate Frame
```

이러한 Frame들의 호출 관계가 우리가 흔히 말하는 **Call Stack**과 연결된다.

```text
┌─────────────────┐
│ Frame: add      │
├─────────────────┤
│ Frame: calculate│
├─────────────────┤
│ Frame: module   │
└─────────────────┘
```

가장 위의 Frame이 현재 실행되고, 함수가 종료되면 해당 Frame에서 벗어나 이전 Frame으로 돌아간다.

---

## 7. 같은 함수라도 Frame은 서로 다르다

이 구조 덕분에 재귀 호출도 가능하다.

```python
def factorial(n):
    if n == 1:
        return 1

    return n * factorial(n - 1)
```

`factorial(3)`을 호출하면 같은 Code Object가 반복해서 실행된다.

하지만 각 호출의 `n`은 다르다.

```text
factorial(3)
factorial(2)
factorial(1)
```

따라서 하나의 실행 상태를 공유할 수 없다.

개념적으로는 다음과 같다.

```text
        same Code Object
              │
      ┌───────┼───────┐
      ▼       ▼       ▼

   Frame    Frame    Frame
   n = 3    n = 2    n = 1
```

**실행할 코드는 같지만 실행 상태는 각각 독립적이다.**

이것이 Code Object와 Frame을 분리해서 이해해야 하는 중요한 이유다.

---

## 8. 실제 Frame을 확인해보자

Python에서는 실행 중인 Frame을 직접 확인할 수도 있다.

```python
import sys

def hello():
    frame = sys._getframe()

    print(frame)
    print(frame.f_code)
    print(frame.f_locals)
    print(frame.f_globals)

hello()
```

`frame.f_code`는 현재 Frame이 실행하고 있는 Code Object를 가리킨다.

```python
frame.f_code
```

`frame.f_locals`에서는 현재 지역 namespace를 확인할 수 있다.

```python
frame.f_locals
```

또한 이전 Frame도 확인할 수 있다.

```python
frame.f_back
```

개념적으로는 다음과 같은 연결이다.

```text
current Frame
      │
      │ f_back
      ▼
previous Frame
      │
      │ f_back
      ▼
previous Frame
```

우리가 에러가 발생했을 때 보는 **Traceback** 역시 이러한 실행 Frame의 흔적과 밀접하게 연결되어 있다.

```text
Traceback (most recent call last):
    ...
```

Traceback이 함수 호출 경로와 실행 위치를 보여줄 수 있는 이유도 Python이 실행 과정에서 이러한 정보를 관리하기 때문이다.

---

## 9. Frame은 Python의 '현재 실행 상태'다

지금까지의 내용을 하나로 합쳐보자.

Code Object에는 **실행할 코드**가 있다.

```text
Code Object
├── Bytecode
├── constants
├── variable names
└── metadata
```

그리고 실제 실행이 시작되면 그 코드를 실행하기 위한 Frame이 필요하다.

```text
Frame
├── Code Object
├── namespace
├── operand stack
├── current instruction
└── previous execution context
```

Python VM은 Frame을 기반으로 Bytecode를 하나씩 실행한다.

```text
            Code Object
                 │
                 ▼
              Frame
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
    namespace   stack   instruction
                 │
                 ▼
             Python VM
                 │
                 ▼
            Opcode 실행
```

따라서 Python 프로그램의 실행을 조금 더 정확하게 표현하면 다음과 같다.

```text
Code Object
    ↓
Frame 생성
    ↓
현재 실행 상태 구성
    ↓
Python VM
    ↓
Bytecode instruction 실행
    ↓
Frame 상태 변경
    ↓
다음 instruction 실행
```

즉 Interpreter는 단순히 Bytecode를 읽는 것만으로 프로그램을 실행하는 것이 아니다.

**Frame이라는 실행 문맥을 유지하면서 Bytecode를 실행한다.**

---

## 10. 여기서 중요한 것은 '멈췄다가 다시 실행할 수 있는 상태'다

Frame을 이해하면 Python의 더 흥미로운 기능들이 보이기 시작한다.

일반적인 함수는 호출되면 실행되다가 `return`을 만나면서 끝난다.

```text
Frame 생성
    ↓
   실행
    ↓
  return
    ↓
 실행 종료
```

그런데 Python에는 실행을 **중간에 멈췄다가 다시 이어서 실행하는 코드**도 있다.

대표적인 것이 Generator다.

```python
def numbers():
    yield 1
    yield 2
    yield 3
```

`yield`에서 실행을 멈췄다가 나중에 다시 실행하려면 무엇을 기억해야 할까?

```text
지역 변수
현재 실행 위치
계산 중간 상태
실행 문맥
```

바로 이번 글에서 살펴본 **실행 상태**가 필요하다.

Coroutine 역시 마찬가지다.

```python
await something()
```

`await`에서 실행을 잠시 넘겨주었다가 나중에 다시 돌아오려면 Python은 **어디까지 실행했는지와 어떤 상태였는지**를 보존해야 한다.

따라서 Frame은 단순히 함수 호출을 이해하기 위한 개념에서 끝나지 않는다.

```text
Frame
  ↓
Function Call
  ↓
Generator
  ↓
Coroutine
  ↓
async / await
  ↓
Event Loop
```

으로 이어지는 Python 실행 모델의 중요한 기반이 된다.

---

## 11. 정리

Python에서 Code Object와 Frame의 역할은 명확하게 구분된다.

```text
Code Object
"What should be executed?"

        ↓

Frame
"What is happening right now?"

        ↓

Python VM
"Execute the next instruction."
```

Code Object가 **실행할 코드**를 표현한다면,

Frame은 그 코드가 실행되는 동안 필요한 **현재 상태**를 표현한다.

Frame에는 지역 및 전역 namespace에 대한 정보가 있고, 연산 과정에서 필요한 Operand Stack이 있으며, 현재 어느 Bytecode instruction을 실행하고 있는지에 대한 상태도 존재한다.

함수를 호출하면 새로운 실행 상태가 필요하고, 따라서 새로운 Frame이 생긴다. 함수 안에서 다른 함수를 호출하면 또 다른 Frame이 필요하다.

결국 Python 프로그램의 실행은 단순히 Bytecode의 나열이 아니다.

```text
   Code Object
       ↓
     Frame
       ↓
    namespace
   operand stack
 instruction position
       ↓
   Python VM
       ↓
  Bytecode 실행
```

**Python Interpreter는 Frame을 통해 "지금 이 코드가 어디까지, 어떤 상태로 실행되고 있는가"를 기억하면서 프로그램을 실행한다.**

그리고 이 실행 상태를 **어떻게 만들고, 쌓고, 제거하며 함수 호출을 이어가는가**를 이해하면 다음 단계인 Python의 함수 호출 구조를 자연스럽게 이해할 수 있다.

---
**다음글: python에서 함수 호출은 내부적으로 어떻게 이루어지는가**
