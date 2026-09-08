---
title: "03. Python Interpreter는 Bytecode를 어떻게 실행하는가"

description: "CPython Interpreter가 Bytecode Instruction을 실행하는 과정을 살펴보고, Python VM과 Opcode, Frame, Evaluation Stack이 실행 과정에서 어떤 역할을 하는지 이해합니다."

pubDatetime: 2026-09-08T12:51:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Python Interpreter
  - Python VM
  - Bytecode

draft: false
---
앞선 글에서는 Python 코드가 다음과 같은 과정을 거쳐 Bytecode로 변환되는 것을 살펴봤다.

```text
Source Code
    ↓
  Token
    ↓
  Parser
    ↓
   AST
    ↓
 Compiler
    ↓
Code Object
    ↓
 Bytecode
```

예를 들어,

```python
a = 1
b = 2
c = a + b
```

라는 코드는 Python이 바로 실행하는 문자열이 아니다.

Compiler는 이 코드를 분석하여 Code Object를 만들고, 그 안에는 Python이 실행할 **Bytecode**가 들어간다.

그렇다면 여기서 새로운 질문이 생긴다.

> **이 Bytecode는 도대체 누가 실행하는 것일까?**

여기서부터 Python Interpreter와 Python Virtual Machine의 이야기가 시작된다.

---

## 1. Python Interpreter란 무엇인가?

우리는 보통 Python 코드를 다음과 같이 실행한다.

```bash
python main.py
```

너무 익숙해서 단순히

> Python이 `main.py`를 실행한다.

라고 생각하기 쉽다.

하지만 `python`이라는 프로그램 내부에서는 훨씬 많은 일이 일어난다.

크게 보면 다음과 같은 과정이다.

```text
main.py
  ↓
Python Interpreter
  ↓
Source Code 분석
  ↓
 AST
  ↓
Compiler
  ↓
Code Object
  ↓
Bytecode
  ↓
Python VM
  ↓
실행
```

여기서 **Interpreter**는 이 전체 실행 환경을 제공하는 프로그램이라고 볼 수 있다.

그리고 우리가 일반적으로 설치해서 사용하는 Python의 대표적인 구현체가 바로 **CPython**이다.

---

## 2. Python과 CPython은 같은 것이 아니다

여기서 먼저 구분해야 하는 것이 있다.

```text
Python
```

과

```text
CPython
```

은 정확히 같은 의미가 아니다.

Python은 **언어**이고, CPython은 그 언어를 실제로 구현한 **구현체**(implementation)다.

예를 들어 Python에는 다음과 같은 문법이 정의되어 있다.

```python
def add(a, b):
    return a + b
```

`def`로 함수를 정의하고, `return`으로 값을 반환하며, `+` 연산자를 사용할 수 있다는 것은 **Python이라는 언어의 규칙**이다.

그런데 이 규칙을 실제 컴퓨터에서 동작하도록 구현한 프로그램이 필요하다.

그중 가장 대표적인 것이 CPython이다.

```text
Python
 └─ Programming Language

CPython
 └─ Python을 구현한 Interpreter
```

CPython이라는 이름의 `C`는 말 그대로 이 구현체의 핵심 부분이 **C로 작성되어 있기 때문**이다.

그리고 우리가 특별히 다른 Python 구현체를 사용하지 않는 이상,

```bash
python main.py
```

라고 실행할 때 사용하는 Python은 대부분 CPython이다.

즉 지금까지 우리가 살펴본

```text
Parser
Compiler
Code Object
Bytecode
```

그리고 앞으로 살펴볼

```text
Python VM
Evaluation Loop
GIL
Garbage Collector
```

같은 이야기 중 상당수는 엄밀히 말하면 **CPython의 구현 방식**에 대한 이야기다.

---

## 3. Python VM은 무엇인가?

앞선 글에서 Compiler가 Python Source Code를 Bytecode로 변환했다.

예를 들어 다음 코드가 있다고 해보자.

```python
def add(a, b):
    return a + b
```

`dis`를 통해 Bytecode를 살펴보면 Python 버전에 따라 세부 명령은 달라질 수 있지만 대략 다음과 같은 명령들을 볼 수 있다.

```text
RESUME
LOAD_FAST
LOAD_FAST
BINARY_OP
RETURN_VALUE
```

이제 누군가는 이 명령들을 읽고 실제 동작을 수행해야 한다.

그 역할을 담당하는 실행 엔진을 개념적으로 **Python Virtual Machine**(PVM)이라고 부른다.

```text
Source Code
     ↓
   Compiler
     ↓
  Bytecode
     ↓
┌───────────────┐
│   Python VM   │
│               │
│ Bytecode 실행 │
└───────────────┘
     ↓
   Result
```

여기서 중요한 점은 Python VM을 JVM처럼 별도로 설치하는 독립 프로그램으로 생각할 필요는 없다는 것이다.

CPython 내부에는 Bytecode를 실행하기 위한 실행 엔진이 존재하고, 우리는 이를 설명하기 위해 **Python VM**이라고 부른다.

즉,

> **CPython Interpreter 내부에서 Bytecode를 실제로 실행하는 부분**

이라고 이해하면 충분하다.

---
## 4. Bytecode는 작은 명령들의 집합이다

Bytecode는 CPU가 직접 실행하는 Machine Code와는 다르다.

CPU는 Python의

```
LOAD_FAST
BINARY_OP
RETURN_VALUE
```

같은 명령을 직접 이해하지 못한다.

이것들은 **Python VM이 실행하는 명령**이다.

예를 들어 다음 함수를 보자.

```
def add(a, b):
    return a + b
```

이 함수의 Bytecode를 단순화하면 다음과 같은 형태로 볼 수 있다.

```
LOAD_FAST a
LOAD_FAST b
BINARY_OP +
RETURN_VALUE
```

여기서 각각의 명령 하나를 **Bytecode Instruction**이라고 한다.

```
LOAD_FAST a     ← Instruction
LOAD_FAST b     ← Instruction
BINARY_OP +     ← Instruction
RETURN_VALUE    ← Instruction
```

그리고 하나의 Instruction을 조금 더 자세히 보면 그 안에서도 역할이 나뉜다.

```
LOAD_FAST  a
─────────  ─
 Opcode    Argument

└──────────────┘
   Instruction
```

`LOAD_FAST`는 **Opcode(Operation Code)​**다.

Opcode는 이 Instruction이 **어떤 동작을 수행하는지** 나타낸다.

여기서는 `LOAD_FAST`이므로 지역 변수의 값을 가져오는 동작을 의미한다.

반면 `a`는 그 동작에 필요한 **Argument**다.

즉 위의 Instruction은 개념적으로 다음과 같은 의미를 가진다.

```
LOAD_FAST  a
    │      │
    │      └── 어떤 값을 가져올 것인가?
    │
    └───────── 어떤 동작을 할 것인가?
```

모든 Instruction에 동일한 형태의 Argument가 필요한 것은 아니지만, 기본적인 관계를 정리하면 다음과 같다.

```
Bytecode
   │
   ├── Instruction
   │      ├── Opcode
   │      └── Argument
   │
   ├── Instruction
   │      ├── Opcode
   │      └── Argument
   │
   └── ...
```

따라서 앞에서 본 Bytecode를 다시 살펴보면,

```
LOAD_FAST a
LOAD_FAST b
BINARY_OP +
RETURN_VALUE
```

`LOAD_FAST`, `BINARY_OP`, `RETURN_VALUE`는 **Opcode의 이름**이고, 각각이 포함된 명령 전체는 **Bytecode Instruction**이다.

각 Instruction이 수행하는 동작을 단순화하면 다음과 같다.

```
LOAD_FAST a
    ↓
지역 변수 a의 값을 가져온다.

LOAD_FAST b
    ↓
지역 변수 b의 값을 가져온다.

BINARY_OP +
    ↓
두 값을 대상으로 연산한다.

RETURN_VALUE
    ↓
결과를 반환한다.
```

즉 우리가 작성한

```
return a + b
```

라는 하나의 표현식이 Compiler에 의해 여러 개의 **Bytecode Instruction**으로 변환되는 것이다.

```
Python Code

return a + b

        ↓ Compiler

Bytecode

LOAD_FAST a
LOAD_FAST b
BINARY_OP +
RETURN_VALUE
```

그리고 Python VM은 이 **Bytecode Instruction들을 하나씩 가져와 실행한다.**

각 Instruction을 실행할 때는 **Opcode를 통해 어떤 동작을 수행할지 결정하고**, 필요한 경우 Argument를 함께 사용한다.

정리하면,

> **Bytecode는 Bytecode Instruction들의 나열이다.**
> 
> **Instruction은 Python VM이 처리하는 하나의 명령이며, Opcode는 그 Instruction이 어떤 동작을 수행할지를 나타낸다.**

---

## 5. Python VM은 Bytecode를 어떻게 실행하는가?

그렇다면 Python VM은 이렇게 만들어진 Bytecode를 어떻게 실행할까?

기본적인 흐름은 단순하다.

Python VM은 **Bytecode Instruction을 하나씩 가져와 실행하고, 다음 Instruction으로 이동하는 과정을 반복한다.**

```
Bytecode

LOAD_FAST a
LOAD_FAST b
BINARY_OP +
RETURN_VALUE

        │
        ▼

Instruction 가져오기
        │
        ▼
Opcode 확인
        │
        ▼
해당 동작 수행
        │
        ▼
다음 Instruction
        │
        └────── ↺
```

예를 들어,

```
LOAD_FAST a
```

라는 Instruction을 가져왔다면 `LOAD_FAST`라는 Opcode에 해당하는 동작을 수행한다.

그다음에는

```
LOAD_FAST b
```

를 실행하고,

그다음에는

```
BINARY_OP +
```

를 실행하는 식이다.

이처럼 Python VM이 Instruction을 가져와 실행하고 다음 Instruction으로 넘어가는 반복적인 실행 구조를 이해할 때 **Evaluation Loop**라는 개념이 등장한다.

실제 최신 CPython의 내부 구현은 여러 최적화가 적용되어 훨씬 복잡하지만, 지금 단계에서는 다음 정도로 이해하면 충분하다.

> **Python VM은 Bytecode Instruction을 하나씩 가져와 그 Instruction의 Opcode에 해당하는 동작을 수행한다.**

즉 Python 프로그램의 실행을 낮은 수준에서 보면,

```
Bytecode
   ↓
Instruction
   ↓
Opcode에 해당하는 동작 수행
   ↓
Next Instruction
   ↓
   ↺
```

라는 반복 과정으로 볼 수 있다.

---

## 6. Python은 정말 한 줄씩 실행될까?

Python을 설명할 때 흔히

> Python은 코드를 위에서 아래로 한 줄씩 실행한다.

라고 이야기한다.

입문 단계에서는 충분히 유용한 설명이지만, 내부적인 실행 단위는 Source Code의 한 줄과 같지 않다.

예를 들어,

```
x = a + b
```

라는 한 줄이 있다고 하자.

Python VM이 이 문자열 한 줄을 그대로 읽어서 실행하는 것이 아니다.

이미 앞선 단계에서 Source Code는 Bytecode로 변환되어 있다.

```
x = a + b

     ↓

LOAD_FAST a
LOAD_FAST b
BINARY_OP +
STORE_FAST x
```

그리고 Python VM은 이 **Bytecode Instruction들을 실행한다.**

즉 Source Code의 한 줄이 하나의 실행 명령과 일대일로 대응하는 것이 아니다.

```
Source Code

x = a + b
    │
    ▼
Compiler
    │
    ▼
Bytecode

LOAD_FAST a
LOAD_FAST b
BINARY_OP +
STORE_FAST x
```

따라서 좀 더 정확하게 표현하면,

> **Python Interpreter는 Source Code의 각 줄을 그대로 실행하는 것이 아니라, Compiler가 생성한 Bytecode Instruction을 실행한다.**

라고 할 수 있다.

물론 디버깅이나 traceback 등을 위해 Bytecode에는 원래 Source Code의 위치와 연결할 수 있는 정보도 존재한다.

하지만 실행 과정을 이해할 때 중요한 것은 **Source Code의 한 줄과 Bytecode Instruction을 같은 것으로 생각하면 안 된다는 점**이다.

---

## 7. 실행 중인 값은 어디에 있을까?

여기까지 보면 새로운 문제가 생긴다.

다음 Bytecode를 다시 보자.

```
LOAD_FAST a
LOAD_FAST b
BINARY_OP +
```

`LOAD_FAST`가 `a`를 가져왔다고 하자.

그러면 가져온 `a`는 어디에 놓이는 것일까?

다음 `LOAD_FAST`가 가져온 `b`는 어디에 있을까?

그리고 `BINARY_OP`는 두 값을 어디에서 가져와 연산하는 것일까?

Bytecode를 실행하려면 단순히 Instruction만 알고 있어서는 안 된다.

예를 들어,

```
def add(a, b):
    c = a + b
    return c
```

를 실행하는 동안 Python은 최소한 다음과 같은 실행 상태를 관리해야 한다.

```
지역 변수 a
지역 변수 b
지역 변수 c

현재 어느 Instruction을 실행하고 있는가?

연산에 필요한 값은 어디에 있는가?
```

즉 Python VM이 Bytecode를 실행하려면 **현재 실행 중인 코드의 상태를 보관할 공간**이 필요하다.

이 실행 상태를 관리하는 핵심 구조가 **Frame**이다.

개념적으로 보면 다음과 같다.

```
        Python VM
            │
            ▼
       Bytecode 실행
            │
            ▼
	┌─────────────────────┐
	│        Frame        │
	│                     │
	│  local variables    │
	│  execution state    │
	│  instruction state  │
	│  evaluation stack   │
	└─────────────────────┘
```

즉 Python VM이 아무런 상태 없이 Bytecode만 읽으며 실행하는 것은 아니다.

**현재 실행 중인 Frame이 실행에 필요한 상태를 가지고 있고, Python VM은 그 상태를 이용해 Bytecode를 실행한다.**

Frame의 구체적인 구조와 역할은 다음 글에서 자세히 살펴볼 것이다.

하지만 여기서는 우선,

> **Bytecode는 실행할 명령을 가지고 있고, Frame은 그 명령을 실행하는 데 필요한 상태를 가지고 있다.**

정도로 구분해두면 충분하다.

---

## 8. Python VM은 Stack을 이용해 연산한다

Frame 안에서 Bytecode 실행과 직접 연결되는 중요한 요소 중 하나가 **Evaluation Stack**이다.

다음 Bytecode를 다시 보자.

```
LOAD_FAST a
LOAD_FAST b
BINARY_OP +
```

이 Instruction들이 실행되는 과정을 단순화하면 다음과 같이 볼 수 있다.

처음에는 Stack이 비어 있다.

```
  Stack

│       │
└───────┘
```

먼저 `LOAD_FAST a`가 실행된다.

```
LOAD_FAST a

	↓

│   a   │
└───────┘
```

다음으로 `LOAD_FAST b`가 실행된다.

```
LOAD_FAST b

    ↓

│   b   │
├───────┤
│   a   │
└───────┘
```

이제 `BINARY_OP +`가 실행된다.

연산에 필요한 두 값을 사용하고 그 결과를 다시 다음 Instruction에서 사용할 수 있도록 만든다.

개념적으로는 다음과 같다.

```
│   b   │
├───────┤
│   a   │
└───────┘

    ↓   BINARY_OP +

│ a + b │
└───────┘
```

이렇게 보면 앞에서 살펴본 Opcode들이 서로 어떻게 연결되는지도 알 수 있다.

```
LOAD_FAST a
     │
     ▼
  Stack에 a

 LOAD_FAST b
     │
     ▼
  Stack에 b

  BINARY_OP +
     │
     ▼
 a와 b를 사용
     │
     ▼
  연산 결과
```

즉 하나의 Instruction이 실행한 결과가 다음 Instruction의 실행에 사용될 수 있다.

이러한 실행 모델 때문에 Python VM을 설명할 때 **Stack-based Virtual Machine**이라는 표현을 사용한다.

다만 최신 CPython의 실제 내부 구현은 여러 최적화가 적용되어 있기 때문에 단순한 고전적 Stack Machine의 그림과 완전히 같다고 생각할 필요는 없다.

지금 단계에서는

```
Bytecode Instruction
        +
Evaluation Stack
```

을 통해 연산이 이어진다는 실행 모델을 잡아두는 것이 중요하다.

---

## 9. 지금까지의 전체 실행 과정을 연결해보자

이제 앞에서 살펴본 내용을 하나로 연결할 수 있다.

우리가 작성한

```
def add(a, b):
    return a + b
```

라는 코드는 처음부터 CPU가 이해하는 명령이 아니다.

먼저 Source Code가 분석된다.

```
Source Code
    ↓
  Token
    ↓
  Parser
    ↓
   AST
```

AST는 Compiler를 거쳐 Code Object와 Bytecode가 된다.

```
   AST
    ↓
 Compiler
    ↓
Code Object
    ↓
 Bytecode
```

Bytecode는 Python VM이 실행할 **Bytecode Instruction들의 나열**이다.

```
Bytecode
   │
   ├── LOAD_FAST a
   ├── LOAD_FAST b
   ├── BINARY_OP +
   └── RETURN_VALUE
```

Python VM은 이 Instruction들을 하나씩 실행한다.

```
Bytecode
    │
    ▼
Python VM
    │
    ▼
Instruction
    │
    ▼
Opcode에 해당하는 동작 수행
    │
    ▼
Next Instruction
    │
    └────── ↺
```

그리고 이 과정은 아무런 상태 없이 이루어지는 것이 아니다.

실행 중인 코드의 상태는 **Frame**을 통해 관리되고, 연산 과정에서는 **Evaluation Stack**이 사용된다.

전체적인 흐름을 단순화하면 다음과 같다.

```
Python Source Code
        │
        ▼
      Token
        │
        ▼
      Parser
        │
        ▼
       AST
        │
        ▼
     Compiler
        │
        ▼
    Code Object
        │
        ▼
     Bytecode
        │
        ▼
┌──────────────────────┐
│  CPython Interpreter │
│                      │
│      Python VM       │
│          │           │
│          ▼           │
│    Instruction       │
│          │           │
│          ▼           │
│       Opcode         │
│          │           │
│          ▼           │
│      Execute         │
│          │           │
│          └──── ↺     │
│                      │
│   Frame / Stack      │
│   실행 상태 관리      │
└──────────────────────┘
```

우리가 평소 아무렇지 않게 실행하던

```
python main.py
```

뒤에서는 이러한 과정들이 연결되어 동작하고 있는 것이다.

---

## 10. Interpreter는 결국 무엇을 하는가?

처음에는 Python Interpreter를 단순히

> Python 코드를 실행해주는 프로그램

이라고 알고 있었다.

틀린 설명은 아니다.

하지만 이제 조금 더 구체적으로 설명할 수 있다.

CPython을 기준으로 Python Source Code는 실행되기 전에 내부적으로 분석되고 Bytecode로 변환된다.

```
Source Code
    ↓
   AST
    ↓
 Bytecode
```

그리고 CPython의 실행 엔진은 만들어진 Bytecode Instruction들을 실행한다.

```
Bytecode
    ↓
Instruction
    ↓
Opcode에 해당하는 동작 수행
    ↓
Next Instruction
    ↓
    ↺
```

즉,

> **CPython Interpreter는 Python Source Code를 내부 실행 표현으로 변환하고, 생성된 Bytecode를 실행하여 프로그램을 동작시키는 Python 구현체다.**

그리고 Bytecode를 실행하는 과정에서는 **현재 실행 상태를 관리하는 구조**가 함께 필요하다.

그 핵심이 바로 Frame이다.

---
## 11. 다음 글로 연결

그런데 아직 중요한 부분을 자세히 살펴보지 않았다.

Interpreter가 Bytecode를 실행하려면 단순히 명령만 가지고 있어서는 안 된다.

예를 들어,

```
def calculate(a, b):
    c = a + b
    return c
```

를 실행하는 동안 Python은 다음과 같은 상태를 관리해야 한다.

```
a는 무엇인가?
b는 무엇인가?
c는 어디에 저장되는가?

현재 어느 Instruction을 실행하고 있는가?

함수가 다른 함수를 호출하면
기존 함수의 실행 상태는 어디에 보관되는가?
```

앞에서 이 실행 상태를 관리하는 핵심 구조가 **Frame**이라고 간단히 살펴봤다.

하지만 아직 Frame이 실제 실행 과정에서 어떤 역할을 하는지는 자세히 다루지 않았다.

```
Code Object
     │
     ▼
   Frame
     │
     ├── 지역 변수
     ├── 현재 실행 상태
     ├── Instruction 진행 상태
     └── Evaluation Stack
```

특히 함수가 호출되면 새로운 실행 상태가 필요하고, 함수 실행이 끝나면 이전 실행 상태로 돌아가야 한다.

이 구조를 이해하면 이후의

```
Function Call
Generator
Coroutine
Exception
```

같은 실행 모델도 훨씬 자연스럽게 연결된다.

다음 글에서는 Python이 **실행 중인 상태를 어떻게 기억하는지**, 그 중심에 있는 **Frame​**을 살펴본다.

```
Bytecode
   ↓
Python VM
   ↓
Frame
   ↓
Evaluation Stack
   ↓
Function Call
```

이제부터는 Python이 코드를 **어떻게 읽고 변환하는가**를 넘어,

**실행 중인 프로그램의 상태를 어떻게 관리하는가**로 들어간다.

---
**다음 글 : Python은 실행 중인 상태를 어떻게 관리하는가**