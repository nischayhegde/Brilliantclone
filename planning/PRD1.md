MVP---------------------------------------------------------
I want to build a clone of brilliant.org which is focused on a niche subject: in this case, stock/options trading education. It should have a simple google auth login which allows users to create/login into accounts to save their progress on lessons. For the basic mvp we should only have 1 lesson. The lesson should have 24 modules. Each module should have a snippet of a chart from a real stock. There should be 10 pairs of modules, each pair should have one module which shows the user the chart, and an overlay explaining the technical analysis pattern. It should show them where to buy and sell. The next module should cover half of a chart and ask the user if the condition of that pattern is fullfilled. It should then reveal the rest of the chart and should show them if they were right or wrong. It should have an explanation telling them why they were wrong. There should be a progress bar uptop showing the user how far they are into the lesson. When the user logs into their account they should enter the dashboard page where they can resume the lesson where they left off. There should also be a streak counter. The streak should count the most modules they completed in one sitting. At the end of the lesson there should be a congratulations screen. The UI should have the same minimialist white, blue, and green design as the official brilliant website. The UI should work cleanly on both desktop and mobile devices. Make the charts/modules animated and interesting to look at.

USER PERSONA---------------------------------------------------------
Amateur stock/option traders who want to learn strategies to become profitable.

USER STORIES---------------------------------------------------------
As a new user I want to easily be able to create an account.
As a learner, I want to see how far I am into a lesson.
As a learner, I want to be able to save my progress on lessons when I exit.
As a trader, I want to be able to learn trading strategies in an interesting and interactive way, not just see an image or a wall of text.
As a trader, I want to be able to practice strategies which I learn.

WHAT NOT TO DO---------------------------------------------------------
dynamically AI generate modules or charts, all charts must come from real stocks, use a public stock api/dataset to get the candles.
Make multiple topics/courses.

TECH STACK---------------------------------------------------------
frontend: vite+react. Phaserjs for animated modules.
backend: firebase backend-as-a-service with firestoreDB for storage.