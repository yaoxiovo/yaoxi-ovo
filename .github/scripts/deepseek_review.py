import os
import subprocess
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com"
)

diff = subprocess.check_output(
    ["git", "diff", "origin/main...HEAD"],
    text=True,
    errors="ignore"
)

if not diff.strip():
    print("No code changes found.")
    exit(0)

prompt = f"""
你是一个严格的代码审查机器人。

请审查下面的 git diff，重点关注：
1. 真实 bug
2. 安全风险
3. 性能问题
4. 边界条件
5. 可维护性
6. 是否需要补测试

要求：
- 用中文输出
- 不要泛泛而谈
- 按严重程度排序
- 如果没有明显问题，直接说“未发现明显问题”

代码 diff：

{diff[:50000]}
"""

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[
        {"role": "system", "content": "你是资深代码审查工程师。"},
        {"role": "user", "content": prompt},
    ],
    stream=False,
)

review = response.choices[0].message.content

with open("deepseek_review.md", "w", encoding="utf-8") as f:
    f.write(review)

print(review)