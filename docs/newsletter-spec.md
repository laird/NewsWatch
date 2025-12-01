Newsletter spec:

- Collect info from all sources into database.
- Sort for relevance based on guidance stored in database (via guidance service).
- Present newsletter in 'old time' newspaper style, with a banner, stories, and a footer.
  - Banner should be NEWSWATCH, with the date/time on the left, and 'price' on the right.
    - Date/time should be standard US date format.
    - the banner title should be NEWSWATCH
    - The 'cost' should be the number of tokens consumed to generate the newsletter. This means that all processing shuold capture token use.
  - Stories should be presented in columns, aproximately 2 inches wide, with a variable number of columns to dynamically 
    fill the window. For example, viewing vertically on a phone should show one column, horizontally 2-3, and on a large 
    tablet or desktop monitor 5-6.
      - Stories should have a title, insights, source(s) and teaser.
      - Thumbs up / down icons should be after the title. Clicking on a thumbs up should cast a vote for more stories like this. 
        And thumbs down should cast a vote for less stories like this.
      - Insights should indicate degree of impact on the market, with a short sentence explaining relevance, 
        challenges and/or opportunities. Insights should be italics.
      - Source(s) should be the name of the source, and the date/time.
      - The teaser should be a paragraph summarizing the story, to let the reader know enough to decide whether to read more.
      - Clicking anywhere on a story should link to the full story.
  - Footer should contain any needed details, and should invite readers to reply with email with suggestions.
    - Feedback can suggest new sources, whether current sources are good or bad, the types of stories that are covered, or anything else the 
      reader wants to communicate.
  - If the recipient is a tester, after the footer should be a box containing the current guidance.
- The system should capture which stories people click on to read.
- The system should capture thumbs-up and thumbs-down clicks

The web site presentation of each issue of the newsletter should be identical to the email version, except:
- the count of up/down votes should be displayed next to the thumbs icons.
