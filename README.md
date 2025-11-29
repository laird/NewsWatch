NewsWatch

Monitor online news sources and produce a daily newsletter every morning containing interesting software economy developments relevant to investors and to CTOs.

## Features

- Monitor online news sources. Continually monitor for which sources are most credible based on user feedback.
- Produce a daily newsletter every morning containing interesting software economy developments relevant to investors and to CTOs.
- Analyze news articles for private equity impact using AI.
- Present a web site with a cover page of the most interesting news articles.
- Present individual article summaries and impact analysis.
- Present an archive of each day's newsletter, allowing readers to go back and view previous issues.
- Present a single, non-personalized view of the most interesting news articles for the community to the community. The goal is to counter the 'tunnel vision' of individuals only seeing news from their favorite sources. 
- Allow community members to vote on the most interesting news articles using a simple thumbs-up or thumbs-down mechanism. The number of up/down votes will be updated in the static web site hourly.
- Allow community members to provide feedback that will shape coverage going forward. Each person who sends feedback receives an updated newsletter incorporating their feedback. Note that feedback can affect which sources are most credible, which subjects are the most interesting, ane editorial guidance around depth of coverage, writing style, etc. Interpret the feedback as a human editor would.
- All feedback will be incorporated into a unified guidance document that will be used to shape coverage going forward. The system administrator will be able to view and edit the guidance document.
- The system will track the number of tokens consumed generating each issue of the newsletter, which will be displayed as the 'cost' of the newsletter. So instead of 'PRICE 5 CENTS the system will display 'COST 5K TOKENS' using the actual generation cost. This means that every insight generation, etc., must be recorded in the database and the total number of tokens consumed must be calculated and displayed.
- All delivery should be via static files, to minimize hosting costs. The system should run hourly to check for new articles, analyze them, and update the static web site.
- The system will be deployed to run on GCP under their free tier, using Cloud Run and Firestore, under the free tier.