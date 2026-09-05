---
title: "01. Python Source Code는 어떻게 읽히는가"
description: "Python Source Code가 Tokenization과 Parsing을 거쳐 AST로 변환되는 과정을 살펴보고, Token, Lexer, Parser, Grammar, AST가 각각 어떤 역할을 하는지 이해합니다."
pubDatetime: 2026-09-04T09:29:00+09:00
tags:
  - Python
  - 파이썬 실행에 대한 이해
  - Token
  - AST
draft: false
---
# 01 Python Source Code는 어떻게 읽히는가

우리는 Python 코드를 다음과 같이 작성한다.

```python
x = 10

if x > 5:
    print("hello")
```

사람이 보기에는 꽤 명확하다.

> `x`에 10을 넣고,  
> `x`가 5보다 크다면 `"hello"`를 출력한다.

하지만 Python은 우리가 작성한 문자열을 보고 곧바로 이런 의미를 이해하는 것이 아니다.

컴퓨터 입장에서 처음 주어지는 것은 결국 다음과 같은 **문자들의 나열**일 뿐이다.

```text
x = 10\n\nif x > 5:\n    print("hello")\n
```

그렇다면 Python은 이 문자들을 어떻게 프로그램으로 이해하는 것일까?

이번 글에서는 Python 코드가 실행되기 전,

```text
Source Code
    ↓
  Token
    ↓
  Parser
    ↓
   AST
```

로 변환되는 과정을 살펴본다.

---

## 1. Source Code는 아직 Python이 아니다

우리가 `.py` 파일에 작성하는 코드를 **Source Code**라고 한다.

```python
total = price * quantity
```

우리는 이 코드를 보면 자연스럽게 구조를 파악한다.

```text
total이라는 변수에
price와 quantity를 곱한 결과를 할당한다.
```

하지만 Python이 처음 파일을 읽는 순간부터 이런 의미를 알고 있는 것은 아니다.

처음에는 사실상 다음과 같은 문자들이 존재할 뿐이다.

```text
t o t a l   =   p r i c e   *   q u a n t i t y
```

여기서부터 Python은 이 문자들의 연속을 자신이 이해할 수 있는 **구조적인 표현**으로 바꿔야 한다.

첫 번째 단계가 **Tokenization**이다.

---

# 2. Token — 문자들을 의미 있는 단위로 나눈다

다음 코드를 생각해보자.

```python
x = 10 + 20
```

Python은 이것을 단순한 문자 하나하나로 계속 다루지 않는다.

대략 다음과 같은 단위로 구분한다.

```text
NAME      'x'
OP        '='
NUMBER    '10'
OP        '+'
NUMBER    '20'
NEWLINE
```

이렇게 소스 코드를 문법적으로 의미 있는 최소 단위로 나눈 것을 **Token**이라고 한다.

예를 들어 Python에는 다음과 같은 종류의 Token이 존재한다.

```text
NAME
NUMBER
STRING
OP
NEWLINE
INDENT
DEDENT
...
```

따라서

```python
age = 20
```

이라는 코드는 개념적으로

```text
[NAME: age]
[OP: =]
[NUMBER: 20]
```

처럼 나누어진다고 생각할 수 있다.

중요한 점은 이 단계에서는 아직

> `age`라는 변수에 정수 20을 할당한다.

라는 프로그램 전체의 구조를 이해한 것이 아니라는 것이다.

단지

> 이것은 이름이고,  
> 이것은 연산자이고,  
> 이것은 숫자다.

정도의 구분이 이루어진 것이다.

---
# 3. Lexer — 문자를 Token으로 바꾸는 과정

일반적인 컴파일러 구조에서는 Source Code를 읽어 Token으로 나누는 과정을 **Lexical Analysis**, 그리고 이를 수행하는 부분을 **Lexer​**라고 부른다.

```
Source Code
     │
     ▼
   Lexer
     │
     ▼
   Token
```

예를 들어

```
result = a + 10
```

이라는 문자들의 나열을 읽어서

```
NAME(result)
OP(=)
NAME(a)
OP(+)
NUMBER(10)
```

처럼 의미 있는 단위로 구분하는 것이다.

`result`와 `a`는 이름을 나타내는 `NAME`, `=`와 `+`는 연산자나 구분 기호를 나타내는 `OP`, `10`은 숫자를 나타내는 `NUMBER`로 구분된다.

다만, Python 공식 문서에서는 이러한 과정을 **lexical analysis**라고 설명하며, 실제 구현을 이야기할 때는 **tokenizer**라는 표현을 사용한다.

컴파일러를 설명할 때 흔히 사용하는 **Lexer** 역시 기본적으로 Source Code를 읽어 Token으로 구분하는 역할을 가리킨다.

따라서 이 글에서는 전체적인 흐름을 이해하기 쉽도록

> **Lexer = Source Code의 문자들을 읽어 Token으로 구분하는 단계**

라고 생각하겠다.

결국 이 단계에서 중요한 것은 Source Code가 단순한 문자들의 나열에서 `NAME`, `NUMBER`, `OP`와 같은 **Token의 나열로 바뀐다는 것**이다.

그런데 Python에서는 이렇게 Token으로 구분되는 것 중에 조금 특별한 것도 있다.

---

# 4. Python에서는 들여쓰기도 Token이다

Python의 Tokenization에서 특히 눈여겨볼 부분이 하나 있다.

바로 **들여쓰기**다.

다른 많은 언어에서는 `{}` 같은 기호를 사용해 코드 블록을 표현한다.

예를 들어 C 계열 언어에서는 다음처럼 작성할 수 있다.

```
if (x > 10) {
    print();
}
```

하지만 Python에서는 코드 블록을 `{}`로 감싸지 않는다.

```
if x > 10:
    print(x)
```

대신 **indentation 자체가 문법의 일부**다.

따라서 Python의 tokenizer는 단순히 문자와 연산자만 구분하는 것이 아니라, 들여쓰기 수준의 변화도 감지한다.

그리고 이러한 변화를 특별한 Token으로 표현한다.

```
INDENT
DEDENT
```

`INDENT`는 새로운 들여쓰기 블록이 시작되었음을 나타내고, `DEDENT`는 이전 들여쓰기 수준으로 돌아왔음을 나타낸다.

예를 들어

```
if x > 10:
    print(x)

print("done")
```

은 개념적으로 다음과 비슷한 Token 흐름을 가진다.

```
NAME(if)
NAME(x)
OP(>)
NUMBER(10)
OP(:)
NEWLINE

INDENT
NAME(print)
...
NEWLINE
DEDENT

NAME(print)
...
```

즉 Python에서 들여쓰기는 단순히 사람이 코드를 보기 좋게 만드는 **formatting**이 아니다.

> **들여쓰기의 변화 역시 Token으로 표현되는 문법적 정보다.**

그래서 Python에서 indentation이 잘못되면 단순한 스타일 문제가 아니라 실제 프로그램의 구조와 문법에 영향을 줄 수 있다.

이렇게 Source Code를 분석하면 Python은 코드가 어떤 **Token들로 이루어져 있는지** 알 수 있게 된다.

하지만 여기서 한 가지 문제가 남는다.

Token 하나하나를 구분할 수 있다는 것과, **그 Token들이 모여 어떤 문법적인 구조를 만드는지 이해하는 것**은 서로 다른 문제다.

---

# 5. Token만으로는 프로그램의 의미를 알 수 없다

그런데 Token을 만드는 것만으로는 충분하지 않다.

예를 들어 다음 Token이 있다고 해보자.

```text
NAME(x)
OP(=)
NUMBER(10)
OP(+)
NUMBER(20)
```

Python은 이제 각각의 조각이 무엇인지는 알고 있다.

하지만 아직 이 조각들이 **어떤 문법적인 관계를 가지고 있는지** 판단해야 한다.

예를 들어

```python
x = 10 + 20
```

은 올바른 코드지만,

```python
x = + * 10
```

은 아니다.

둘 다 각각의 문자 자체는 Token으로 만들 수 있다.

```text
NAME
OP
OP
NUMBER
```

하지만 Token의 배열이 Python 문법에 맞는지는 별개의 문제다.

이것을 판단하는 것이 **Parser**다.

---

# 6. Parser — Token에서 문법적 구조를 찾는다

Parser는 Token들을 받아서

> 이 Token들이 Python 문법에 따라 어떤 구조를 이루고 있는가?

를 분석한다.

예를 들어

```python
x = 10 + 20
```

을 생각해보자.

Tokenizer가 만들어낸 것은 대략

```text
NAME(x)
OP(=)
NUMBER(10)
OP(+)
NUMBER(20)
```

이다.

Parser는 여기에서 관계를 발견한다.

```text
Assignment
│
├── Target
│   └── x
│
└── Value
    └── Addition
        ├── 10
        └── 20
```

이제 단순한 Token의 나열이 아니라

> 이것은 Assignment이고,  
> 왼쪽 대상은 `x`이고,  
> 오른쪽 값은 `10 + 20`이라는 연산이다.

라는 **문법적인 구조**가 생겼다.

이 차이가 중요하다.

Tokenization이

```text
무엇이 있는가?
```

를 구분하는 과정이라면,

Parsing은

```text
그것들이 어떤 관계를 이루고 있는가?
```

를 분석하는 과정이다.

---

# 7. 문법에 맞지 않으면 Parser에서 실패한다

우리가 Python 코드를 작성하다 보면 다음과 같은 오류를 자주 만난다.

```python
if x > 10
    print(x)
```

실행하면 `SyntaxError`가 발생한다.

왜냐하면 Python 문법에서 `if` statement는 조건 뒤에 `:`가 필요하기 때문이다.

즉 각각의 요소를 Token으로 구분할 수 있다고 하더라도,

```text
if
x
>
10
```

이 Token들의 배치가 Python의 `if` 문법을 만족하지 못한다.

따라서 Parser는 정상적인 프로그램 구조를 만들 수 없다.

우리가 흔히 보는

```text
SyntaxError
```

는 바로 이 **문법 구조를 분석하는 과정**과 관련된 오류라고 볼 수 있다.

---

# 8. Python은 어떤 문법을 기준으로 판단하는가?

그렇다면 Parser는 어떻게

```python
x = 10
```

은 맞고

```python
x = = 10
```

은 틀렸다는 것을 알까?

Python에는 당연히 **Python 문법(grammar)** 이 정의되어 있기 때문이다.

개념적으로 생각하면 다음과 같은 규칙들이 존재한다.

```text
assignment:
    target '=' expression
```

또는

```text
if_statement:
    'if' expression ':' block
```

Parser는 Token들을 이 문법 규칙과 비교하면서 구조를 만들어간다.

즉 우리가 Python 문법이라고 부르는

```python
if condition:
    ...

for item in items:
    ...

def func():
    ...
```

같은 규칙은 단순히 프로그래머가 외워야 하는 작성법이 아니다.

**Python Parser가 Source Code를 프로그램으로 해석하기 위해 사용하는 규칙이기도 하다.**

---

# 9. AST — 코드의 핵심 구조만 남긴다

Parsing을 거치면서 Python은 코드의 구조를 표현할 수 있게 된다.

그리고 그 결과를 대표하는 중요한 구조가 **AST(Abstract Syntax Tree)** 다.

한국어로는 보통 **추상 구문 트리**라고 부른다.

예를 들어

```python
x = 10 + 20
```

이라는 코드가 있다.

이것을 AST 관점에서 단순화하면 다음과 비슷하다.

```text
Module
└── Assign
    ├── Name(x)
    └── BinOp
        ├── Constant(10)
        ├── Add
        └── Constant(20)
```

여기에는 우리가 작성했던 코드의 문자 모양이 그대로 저장되어 있지 않다.

```python
x       =       10      +      20
```

처럼 공백을 몇 개 사용했는지는 중요하지 않다.

AST가 관심을 가지는 것은 코드의 **구조**다.

```text
Assign
 ├─ x
 └─ Add
     ├─ 10
     └─ 20
```

그래서 이름이 **Abstract Syntax Tree**다.

Source Code의 모든 표면적인 표현을 그대로 보존하는 것이 아니라, 프로그램을 이해하는 데 필요한 문법적인 구조를 **추상화해서 Tree 형태로 표현한다.**

---

# 10. 왜 Tree일까?

다음 코드를 보자.

```python
result = 10 + 20 * 30
```

우리는 연산자 우선순위를 알고 있기 때문에 이것을

```python
result = 10 + (20 * 30)
```

으로 이해한다.

AST에서도 이러한 관계가 구조적으로 표현된다.

```text
Assign
│
├── Name(result)
│
└── Add
    ├── Constant(10)
    │
    └── Multiply
        ├── Constant(20)
        └── Constant(30)
```

즉

```text
20 * 30
```

이 하나의 하위 구조가 되고,

그 결과와 `10`이 다시 `+` 관계를 형성한다.

프로그램은 이런 식으로 구조 안에 또 다른 구조가 계속 들어갈 수 있다.

```python
if user.is_active:
    send_message(user.name)
```

이 코드에도

```text
if statement
 ├── condition
 │    └── attribute access
 │
 └── body
      └── function call
           └── attribute access
```

처럼 계층적인 관계가 존재한다.

그래서 코드의 문법 구조를 표현하기에 **Tree가 매우 자연스럽다.**

---

# 11. 실제 Python에서 AST를 확인해보자

Python은 `ast`라는 표준 라이브러리를 제공하기 때문에 우리가 직접 AST를 확인할 수도 있다.

```python
import ast

code = """
x = 10 + 20
"""

tree = ast.parse(code)

print(ast.dump(tree, indent=4))
```

실행하면 대략 다음과 같은 구조를 확인할 수 있다.

```text
Module(
    body=[
        Assign(
            targets=[
                Name(id='x', ctx=Store())
            ],
            value=BinOp(
                left=Constant(value=10),
                op=Add(),
                right=Constant(value=20)
            )
        )
    ]
)
```

처음 보면 상당히 복잡해 보이지만 구조를 하나씩 보면 어렵지 않다.

```text
Module
```

Python 코드 전체를 나타내고,

```text
Assign
```

할당문을 나타낸다.

그 안에는

```text
Name(id='x')
```

라는 할당 대상과

```text
BinOp
```

이라는 이항 연산이 존재한다.

그리고 `BinOp` 안에는

```text
Constant(10)
Add()
Constant(20)
```

이 들어 있다.

결국 우리가 작성한

```python
x = 10 + 20
```

이라는 문자열이 이제 Python이 다룰 수 있는 **구조적인 프로그램 표현**으로 바뀐 것이다.

---

# 12. Source Code와 AST는 같은 코드가 아니다

여기서 중요한 차이가 하나 있다.

다음 두 코드를 생각해보자.

```python
x=10+20
```

```python
x = 10 + 20
```

사람이 보기에는 formatting이 다르다.

하지만 Python의 실행 관점에서는 본질적으로 같은 프로그램이다.

둘 다 AST에서는 핵심적으로

```text
Assign
└── x
    └── Add
        ├── 10
        └── 20
```

이라는 동일한 구조를 표현한다.

즉 Source Code는 **사람이 작성하는 표현**에 가깝고,

AST는 그 코드에서 표면적인 요소를 걷어내고 **Python이 이해한 문법적 구조를 표현한 것**에 가깝다.

이 차이를 이해하면 AST에서 왜 주석이나 일부 formatting 정보가 사라지는지도 자연스럽게 이해할 수 있다.

---

# 13. 여기까지 왔다고 코드가 실행되는 것은 아니다

이제 Python은 우리가 작성한 코드를 꽤 많이 이해했다.

처음에는

```text
x = 10 + 20
```

이라는 문자들의 나열에 불과했다.

Tokenization을 거치면서

```text
NAME(x)
OP(=)
NUMBER(10)
OP(+)
NUMBER(20)
```

이라는 단위가 되었고,

Parsing을 거치면서

```text
Assign
 ├── Name(x)
 └── BinOp
      ├── 10
      ├── +
      └── 20
```

이라는 구조가 되었다.

하지만 아직 CPU가 `10 + 20`을 계산하고 `x`라는 이름에 결과를 연결한 것은 아니다.

**AST는 프로그램의 구조를 표현한 것이지, 프로그램의 실행 그 자체는 아니다.**

Python은 이제 이 AST를 다음 단계의 실행 가능한 표현으로 바꿔야 한다.

그 과정에서 등장하는 것이 바로 **Bytecode**다.

---

# 14. 전체 흐름 정리

지금까지의 과정을 크게 보면 다음과 같다.

```text
Python Source Code
        │
        │  문자들의 연속
        ▼
Lexical Analysis
        │
        │  문자를 의미 있는 단위로 구분
        ▼
      Token
        │
        │  NAME, NUMBER, OP,
        │  INDENT, DEDENT ...
        ▼
      Parser
        │
        │  Python Grammar에 따라
        │  Token 사이의 관계 분석
        ▼
       AST
        │
        │  프로그램의 문법적 구조
        ▼
       ???
```

각 단계의 역할을 한 문장으로 정리하면 다음과 같다.

```text
Source Code
"어떤 문자들이 작성되어 있는가?"

        ↓

Token
"각 문자는 어떤 문법적 단위인가?"

        ↓

Parser
"이 Token들은 어떤 문법적 관계를 이루는가?"

        ↓

AST
"그 관계를 구조적으로 표현하면 무엇인가?"
```

그리고 여기서 한 가지 새로운 질문이 생긴다.

Python은 AST라는 코드의 구조를 얻었다.

그렇다면 이 구조가 어떻게 실제 실행으로 이어질까?

```text
  AST
   ↓
   ?
   ↓
Python VM
   ↓
  실행
```

그 사이를 연결하는 것이 Python의 **Bytecode**다.

다음 글에서는 AST가 어떻게 Bytecode로 변환되는지, 그리고 우리가 종종 보게 되는 `.pyc` 파일은 무엇인지 살펴보자.

---
**다음 글: 02. Python은 왜 Bytecode를 만드는가**