# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - heading "NewsWatch" [level=1] [ref=e4]
    - paragraph [ref=e5]: Admin Panel
  - generic [ref=e6]:
    - generic [ref=e7]:
      - heading "🤖 AI Guidance Editor" [level=2] [ref=e8]
      - generic [ref=e9]:
        - generic [ref=e10]: "Current AI Instructions:"
        - textbox "Current AI Instructions:" [ref=e11]:
          - /placeholder: Loading guidance...
        - generic [ref=e12]: 0 characters
      - button "💾 Save Guidance" [ref=e13] [cursor=pointer]
    - generic [ref=e14]:
      - heading "📧 Newsletter Testing" [level=2] [ref=e15]
      - paragraph [ref=e16]: Generate and send a test newsletter to all test users with the current guidance included.
      - button "⚡ Generate & Send Test Newsletter" [disabled] [ref=e17]
      - generic [ref=e19]: ⏳ Generating newsletter... This may take a minute.
    - generic [ref=e20]:
      - heading "📚 Recent Newsletter Archives" [level=2] [ref=e21]
      - list [ref=e22]:
        - listitem [ref=e23]: Loading archives...
```