이 Markdown 파일 전체를 검수해줘.

이번 작업의 목적은 **글의 내용 수정이 아니라 Markdown 문법과 포맷 오류를 찾아 수정하는 것**이야.

다음 기준으로 전체 파일을 확인해줘.

1. Markdown escape 오류

   * `**\*\*text\*\***`처럼 bold 문법이 중복되거나 escape된 부분
   * `\_`, `\*`, `\<`, `\>`, `\=` 등 불필요하게 escape된 문자
   * 정상적인 Markdown 문법이 문자 그대로 노출되는 부분

2. Bold / Inline Code

   * `**text**`가 정상적으로 렌더링되는지
   * bold 내용이 `)` 같은 문장 부호로 끝나고 닫는 `**` 바로 뒤에 한글 조사나 문자가 붙어 있는지 확인할 것
     * 예: `**AST(Abstract Syntax Tree)**를`은 CommonMark에서 닫는 `**`로 인식되지 않아 문법이 그대로 노출될 수 있음
     * 이 경우 문구 자체는 바꾸지 말고 `**AST**(Abstract Syntax Tree)를`처럼 문장 부호 앞에서 bold를 닫아 정상적으로 렌더링되게 수정할 것
   * `**Generator**는`, `**Frame**이`, `**상태**로`처럼 bold 내용이 일반 문자로 끝나고 바로 뒤에 한글 조사가 붙는 경우는 정상적으로 렌더링되므로 수정하지 말 것
   * 즉, 닫는 `**` 앞이 `)` 같은 문장 부호인 경우만 위 문제의 대상으로 판단하고, 조사 결합 자체를 일괄 수정하지 말 것
   * backtick으로 감싼 inline code가 정상적인지
   * bold와 inline code가 불필요하게 중첩되지 않았는지

3. Heading

   * `**## 제목**` 같은 잘못된 형태가 없는지
   * `## 제목` 형태로 정상적으로 작성되어 있는지
   * 기존 heading level은 변경하지 말 것

4. Code Block

   * `python, `text 등의 opening/closing fence가 정상적으로 대응하는지
   * 코드 블록 내부 내용은 수정하지 말 것
   * 코드 블록의 줄바꿈과 indentation을 유지할 것

5. Blockquote / Horizontal Rule

   * `>` blockquote가 정상적인지
   * `---` horizontal rule이 불필요하게 bold 처리되어 있지 않은지

6. 줄바꿈

   * 기존 문단 구분과 줄바꿈을 최대한 그대로 유지할 것
   * 임의로 문장을 합치거나 새로운 줄바꿈을 추가하지 말 것
   * 특히 code block과 text diagram의 줄바꿈/공백을 절대 변경하지 말 것

7. Frontmatter

   * YAML frontmatter의 내용과 값은 변경하지 말 것
   * Markdown 문법 정리를 이유로 frontmatter를 수정하지 말 것

### 중요한 제한

* 글의 문장, 표현, 설명, 순서 등 **콘텐츠는 수정하지 말 것**
* 기술적인 내용도 이번 작업에서는 수정하지 말 것
* 오직 Markdown 문법/escape/format 문제만 수정할 것
* 확신할 수 없는 부분은 임의로 수정하지 말고 마지막 검수 결과에 기록할 것
* 수정 후 대상 파일에 한정하여 `git diff -- <파일>`을 확인할 것
* 문장, 표현, 순서, 문단 및 code block 내부가 의도치 않게 변경되지 않았는지 다시 검수할 것
* Markdown 콘텐츠만 수정한 경우 전체 `npm run build`는 실행하지 말 것
* frontmatter 또는 실제 렌더링 호환성이 의심되는 경우에만 추가 검증이나 build를 수행할 것

마지막으로 작업 결과를 다음 형식으로 알려줘.

* 수정한 Markdown 문제
* 수정하지 않고 유지한 부분
* 추가 확인이 필요한 부분
* `git diff` 기준으로 콘텐츠 변경 여부
