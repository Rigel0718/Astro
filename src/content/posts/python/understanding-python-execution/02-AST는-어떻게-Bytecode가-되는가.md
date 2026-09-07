---
title: "02. AST는 어떻게 Bytecode가 되는가"

description: "Python의 AST가 Compiler를 거쳐 Code Object와 Bytecode로 변환되는 과정을 살펴보고, .pyc 캐시의 역할을 이해합니다."

pubDatetime: 2026-09-07T16:56:00+09:00

tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Bytecode
  - Code Object

draft: false
---

지난 글에서는 우리가 작성한 Python Source Code가 어떻게 읽히는지 살펴봤다.

```text
Source Code
    ↓
  Token
    ↓
  Parser
    ↓
   AST
```

예를 들어 다음과 같은 코드를 작성했다고 해보자.

```python
x = 10
y = 20
print(x + y)
```

우리에게는 단순한 세 줄의 코드지만 Python은 이 문자열을 그대로 실행하지 않는다.

먼저 코드를 읽고 문법적인 구조를 파악하여 **AST**(Abstract Syntax Tree)를 만든다.

하지만 AST 역시 CPU가 실행할 수 있는 명령도 아니고, Python Interpreter가 직접 하나씩 실행하는 최종 명령도 아니다.

Python은 AST를 한 단계 더 변환한다.

```text
AST
 ↓
Compiler
 ↓
Code Object
 ↓
Bytecode
```

이번 글에서는 **Python의 AST가 어떻게 실행 가능한 Bytecode로 변환되는지** 살펴보려고 한다.

---

## 1. AST는 아직 실행 코드가 아니다

지난 글에서 AST는 Python Source Code의 **문법적인 의미를 Tree 형태로 표현한 것**이라고 했다.

다음 코드를 생각해보자.

```python
x = 1 + 2
```

Python은 대략 다음과 같은 구조로 코드를 이해할 수 있다.

```text
Assign
├── Name(x)
└── BinOp
    ├── Constant(1)
    ├── Add
    └── Constant(2)
```

중요한 것은 AST가 더 이상 단순한 문자열이 아니라는 것이다.

```text
"x = 1 + 2"
```

라는 문자열이

```text
변수 x에
1과 2를 더한 결과를
대입한다.
```

라는 **구조적인 의미**로 변환되었다.

하지만 여기서 문제가 하나 있다.

AST는 코드가 **무엇을 의미하는지 표현하는 구조**이지, Python Virtual Machine이 실제로 수행할 명령의 나열은 아니다.

즉,

```text
AST
= 코드의 구조와 의미를 표현

Bytecode
= Python VM이 수행할 명령을 표현
```

이라고 볼 수 있다.

따라서 AST와 실제 실행 사이에는 이 둘을 연결해주는 과정이 필요하다.

그 역할을 하는 것이 **Compiler**다.

---

## 2. Python에도 Compiler가 있다

Python을 흔히 **인터프리터 언어**(Interpreted Language)라고 부른다.

그래서 Python에는 Compiler가 없다고 생각하기 쉽다.

하지만 CPython에는 Compiler가 존재한다.

다만 C나 C++처럼 Source Code를 곧바로 Native Machine Code로 변환하는 방식과는 다르다.

대략적인 차이를 단순화하면 다음과 같다.

```text
C

Source Code
    ↓
 Compiler
    ↓
Machine Code
    ↓
   CPU
```

반면 CPython은 대략 다음과 같은 과정을 거친다.

```text
Python Source Code
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
```

즉 Python에서도 **컴파일 과정이 존재한다.**

다만 그 결과가 CPU가 직접 실행하는 Machine Code가 아니라, **Python Virtual Machine이 실행할 Bytecode**라는 차이가 있다.

그래서 Python을 단순히

> Python은 컴파일하지 않고 한 줄씩 읽어서 실행한다.

라고 이해하면 실제 CPython의 동작과는 꽤 차이가 있다.

조금 더 정확하게 표현한다면,

> CPython은 Python Source Code를 Bytecode로 컴파일하고, Python Virtual Machine이 그 Bytecode를 실행한다.

라고 할 수 있다.

---

## 3. Compiler는 AST를 무엇으로 바꿀까?

그렇다면 Compiler는 AST를 받아서 바로 Bytecode 파일을 만드는 것일까?

여기서 **Code Object**라는 중요한 객체가 등장한다.

```text
   AST
    ↓
 Compiler
    ↓
Code Object
    ↓
 Bytecode
```

Python에서는 컴파일된 코드에 대한 여러 정보를 **Code Object**라는 객체에 담는다.

직접 확인해볼 수도 있다.

```python
code = compile("x = 1 + 2", "<string>", "exec")

print(type(code))
```

결과는 다음과 같다.

```text
<class 'code'>
```

`compile()`은 Python Source Code 또는 AST를 컴파일하여 Code Object를 반환한다.

즉,

```python
code = compile(...)
```

에서 만들어진 `code`는 문자열도 아니고 AST도 아니다.

**Python이 실행할 수 있도록 컴파일된 코드 객체**다.

---

## 4. Code Object에는 무엇이 들어 있을까?

Code Object를 단순히 Bytecode 자체라고 생각할 수도 있지만 둘은 정확히 같은 개념은 아니다.

Code Object는 Bytecode뿐만 아니라 **코드를 실행하는 데 필요한 여러 메타데이터를 함께 가지고 있는 객체**다.

예를 들어 다음 코드를 보자.

```python
def add(a, b):
    return a + b
```

함수의 `__code__`를 통해 Code Object를 확인할 수 있다.

```python
print(add.__code__)
```

그리고 내부에는 다음과 같은 정보들이 들어 있다.

```python
print(add.__code__.co_varnames)
print(add.__code__.co_consts)
print(add.__code__.co_names)
print(add.__code__.co_code)
```

대략 각각 다음과 같은 역할을 한다.

```text
co_varnames
→ 지역 변수와 매개변수에 대한 정보

co_consts
→ 코드에서 사용하는 상수

co_names
→ 코드에서 참조하는 이름

co_code
→ Bytecode를 담고 있는 bytes
```

여기서 특히 중요한 것이 `co_code`다.

```python
print(add.__code__.co_code)
```

출력하면 사람이 읽기 어려운 bytes가 나온다.

즉 Code Object 안에는 실제로 Python VM이 실행할 **Bytecode 명령 정보**가 들어 있다.

관계를 정리하면 다음과 같다.

```text
Code Object
├── Bytecode
├── Constants
├── Variable information
├── Name information
└── Execution metadata
```

따라서

> **Bytecode는 Code Object에 포함된 실행 명령이며, Code Object는 그 Bytecode를 실행하는 데 필요한 정보까지 함께 담고 있는 객체다.**

라고 이해하면 좋다.

---

## 5. Bytecode란 무엇인가?

이제 Bytecode가 등장한다.

Bytecode는 **Python Virtual Machine이 이해하고 실행할 수 있도록 만들어진 중간 명령어**다.

예를 들어

```python
def add(a, b):
    return a + b
```

라는 코드가 있다고 하자.

사람에게는

```text
a와 b를 더해서 반환한다.
```

라는 의미지만 Python VM 입장에서는 이를 더 작은 실행 단위의 명령으로 처리해야 한다.

개념적으로 생각하면 다음과 비슷하다.

```text
a를 가져온다
b를 가져온다
두 값을 더한다
결과를 반환한다
```

이러한 VM 수준의 명령들이 **Bytecode Instruction**이다.

여기서 중요한 점은 Bytecode가 **CPU 명령어가 아니라는 것**이다.

```text
Machine Code
→ CPU가 실행

Python Bytecode
→ Python VM이 실행
```

따라서 Python Bytecode는 특정 CPU의 `x86`, `ARM` 명령어와는 다른 계층에 존재한다.

---

## 6. `dis`로 Bytecode를 직접 확인해보자

Python은 Bytecode를 사람이 읽을 수 있도록 보여주는 표준 라이브러리를 제공한다.

바로 `dis` 모듈이다.

`dis`는 **disassembler**에서 나온 이름이다.

다음 함수를 살펴보자.

```python
def add(a, b):
    return a + b
```

그리고 다음과 같이 실행한다.

```python
import dis

dis.dis(add)
```

Python 버전에 따라 세부 출력은 조금씩 다르지만 대략 다음과 같은 Bytecode Instruction을 볼 수 있다.

```text
RESUME
LOAD_FAST
LOAD_FAST
BINARY_OP
RETURN_VALUE
```

이를 개념적으로 해석하면 다음과 같다.

```text
LOAD_FAST a
    ↓
a를 가져온다

LOAD_FAST b
    ↓
b를 가져온다

BINARY_OP +
    ↓
두 값을 더한다

RETURN_VALUE
    ↓
결과를 반환한다
```

우리가 작성했던

```python
return a + b
```

라는 한 줄의 코드가 Python VM이 처리할 수 있는 여러 Instruction으로 변환된 것이다.

즉,

```text
Source Code

return a + b
```

가 최종적으로

```text
LOAD_FAST
LOAD_FAST
BINARY_OP
RETURN_VALUE
```

와 같은 실행 단위로 바뀐다고 볼 수 있다.

이 명령들을 실제로 하나씩 처리하는 주체가 바로 **Python Virtual Machine**이다.

이 부분은 다음 글에서 더 자세히 살펴보게 된다.

---

## 7. Source Code와 Bytecode는 1:1 관계가 아니다

여기서 한 가지 중요한 특징이 있다.

Source Code 한 줄이 반드시 Bytecode 하나가 되는 것은 아니다.

예를 들어

```python
result = a + b
```

라는 하나의 표현도 내부적으로는 여러 작업이 필요하다.

```text
a를 가져온다
    ↓
b를 가져온다
    ↓
더한다
    ↓
result에 저장한다
```

즉 Source Code는 사람이 이해하기 좋은 고수준 표현이고, Bytecode는 VM이 실행하기 좋은 더 작은 단위의 표현이다.

```text
High Level

result = a + b

      ↓ compile

Low Level

LOAD ...
LOAD ...
BINARY_OP ...
STORE ...
```

이러한 관점에서 보면 Compiler의 역할도 조금 더 명확해진다.

Compiler는 AST가 표현하고 있는 고수준의 의미를 분석하여 **Python VM이 수행할 수 있는 명령의 형태로 낮춰준다.**

---

## 8. 함수도 자신만의 Code Object를 가진다

Python에서 함수를 정의하면 함수 객체 내부에는 해당 함수의 실행 코드가 들어 있는 Code Object가 연결된다.

```python
def add(a, b):
    return a + b
```

개념적으로는 다음과 같은 관계가 만들어진다고 볼 수 있다.

```text
add
 │
 ▼
Function Object
 │
 └── __code__
       │
       ▼
   Code Object
       │
       ├── Bytecode
       ├── Constants
       ├── Variable information
       └── Metadata
```

여기서 지난 **Python 객체에 대한 이해** 시리즈와도 연결되는 부분이 생긴다.

Python에서 함수는 단순히 코드 덩어리가 아니라 **객체**다.

그리고 그 함수 객체가 실행에 필요한 Code Object를 참조하고 있다.

```python
print(type(add))
```

```text
<class 'function'>
```

반면

```python
print(type(add.__code__))
```

는

```text
<class 'code'>
```

다.

즉,

```text
Function Object
≠
Code Object
```

이다.

함수 객체에는 함수 자체의 여러 상태와 정보가 존재하고, 그중 `__code__`가 **컴파일된 실행 코드**를 가리킨다.

이 구분은 이후 Function Call과 Stack Frame을 이해할 때 다시 중요해진다.

---

## 9. 그렇다면 `.pyc`는 무엇일까?

Python 프로젝트를 실행하다 보면 다음과 같은 디렉터리를 본 적이 있을 것이다.

```text
__pycache__/
```

그 안에는 다음과 같은 파일이 만들어질 수 있다.

```text
example.cpython-3xx.pyc
```

여기서 `.pyc`는 **컴파일된 Python 코드와 관련된 캐시 파일**이다.

Python은 모듈을 import할 때 매번 Source Code를 처음부터 다시 컴파일해야 한다면 불필요한 비용이 발생할 수 있다.

```text
   .py
    ↓
  Parse
    ↓
   AST
    ↓
 Compile
    ↓
Code Object
```

그래서 재사용할 수 있는 컴파일 결과를 `.pyc` 형태로 캐시할 수 있다.

다음번에 해당 모듈을 import할 때 캐시가 유효하다면 이 결과를 활용할 수 있다.

개념적으로는 다음과 같다.

```text
처음 import

   .py
    ↓
   AST
    ↓
 Compiler
    ↓
Code Object
    ↓
.pyc cache
    ↓
   실행
```

그리고 이후에는 조건이 맞는다면

```text
  .pyc
    ↓
Code Object 복원
    ↓
   실행
```

처럼 컴파일 과정의 일부를 다시 수행하지 않아도 된다.

---

## 10. `.pyc`는 실행 파일이 아니다

여기서 `.pyc`에 대해 자주 생기는 오해가 하나 있다.

`.pyc`를 C/C++의 컴파일 결과물과 동일하게 생각하면 안 된다.

예를 들어 C 프로그램을 컴파일하면 CPU가 실행할 수 있는 Machine Code가 만들어진다.

하지만 Python의 `.pyc`는 그런 Native Executable이 아니다.

```text
C

  Source
    ↓
Machine Code
    ↓
   CPU
```

반면 Python에서는

```text
Python Source
     ↓
  Bytecode
     ↓
  Python VM
```

이라는 계층이 존재한다.

따라서 `.pyc`가 있다고 하더라도 그것을 실행하기 위해서는 여전히 **호환되는 Python Runtime이 필요하다.**

또한 Python Bytecode는 Python 구현과 버전에 따라 달라질 수 있다.

그래서 `.pyc`는

> Python 코드를 Machine Code로 만들어 놓은 파일

이라기보다는

> **Python의 컴파일 결과를 다시 활용하기 위해 저장해 둔 캐시**

에 가깝게 이해하는 것이 좋다.

---

## 11. 여기까지의 전체 실행 흐름

지난 글과 이번 글을 연결하면 Python Source Code는 지금까지 다음 과정을 거쳤다.

```text
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
```

그리고 필요에 따라 컴파일된 결과가

```text
.pyc
```

형태로 캐시될 수도 있다.

이제 처음 작성했던 코드

```python
x = 10
y = 20
print(x + y)
```

는 더 이상 단순한 문자열이 아니다.

Python은 Source Code를 읽어 문법 구조를 파악했고,

```text
AST
```

Compiler가 이를 실행 가능한 형태로 변환하여

```text
Code Object
```

를 만들었으며, 그 안에는 Python VM이 처리할

```text
Bytecode
```

가 들어 있다.

---

## 12. 그런데 Bytecode는 누가 실행할까?

여기까지 오면 자연스럽게 다음 질문이 생긴다.

`dis`를 통해 다음과 같은 Bytecode가 만들어졌다는 것은 확인했다.

```text
LOAD_FAST
LOAD_FAST
BINARY_OP
RETURN_VALUE
```

그렇다면 **도대체 누가 이 명령들을 읽고 실행하는 것일까?**

CPU가 직접 실행하는 것은 아니다.

Python에서는 이 명령들을 처리하는 실행 계층이 존재한다.

바로 **Python Virtual Machine**(PVM)이다.

그리고 우리가 흔히 이야기하는 **Python Interpreter**, 특히 CPython이라는 구현체가 이 과정과 연결된다.

지금까지는

```text
Source Code
    ↓
   AST
    ↓
Compiler
    ↓
Code Object
    ↓
 Bytecode
```

까지 살펴봤다면,

다음 글에서는 드디어

```text
Bytecode
    ↓
Python VM
    ↓
Execution
```

으로 넘어간다.

---
**다음 글 : 03 Python Interpreter는 Bytecode를 어떻게 실행하는가**