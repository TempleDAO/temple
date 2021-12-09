## Design system proposal

### Components

My suggestion for a design system consists of 3 main components:

- Design workbench 
  - Environment used to experiment with designs where all the mockups and UI concepts live. Acts as a bridge between designers and implementers. Allows non-react devs and designers to contribute to the UI.
    - Figma, Zeplin
- Component creation workbench
  - Environment used to implement the mockups created in the design workbench. Isolated environment where components are created without any intrinsic state or behaviour.
  - The goal of this environment is to allow developers to implement UI components decoupled from the application's logic and state. If a component needs state or callback functions they should be passed as props. Stories/fixtures can and should provide mock data and stubs for the callbacks.
  - Most importantly, this environment will allow us to test how the UI components present themselves with different states. While the mockup will have an example use case, the component creation workbench **MUST** have the component being presented in a multitude of scenarios. This allows us to catch edge cases that can come up if a component deals with dynamic size or dynamically sized children such as a label being extremely long or having no value at all.
  - Besides having stories/fixtures showing individual components we should also have more complex stories that encompass whole pages or sections of a page.
    - Storybook, React Cosmos
- Consumer dapp
  - The dapp itself should import all reusable components from the component creation workbench. Single use components that cannot be converted to generalized components in a sane way can live here instead.
  - The component creation workbench can live inside the dapp's directory structure or it could live outside of it depending on how decoupled we want it to be and how we want to approach scale in terms of front-ends (vertically vs horizontally).

#### Suggested technologies

- Design workbench -> **Figma**
  - Zeplin would be a strong canddate if we were building more of a SSG app as it thrives as a tool to share design assets in a *fixed/static* state which is not the vision we have for the dapp at the moment. (It also offers less freedom when it comes to collaboration between design team members)
  - Figma on the other hand allows for the creation of interactible mockups in addition to static ones making it more flexible than Zeplin.
  - Figma allows a greater degree of freedom when it comes to collaborative work. It is possible to have multiple contributors with permission to view/edit multiple pages in Figma. This is especially important to us since most of our work will be done asynchronously by a team with rotating contributors.
  - Browser based and written in WASM makes it easily accessible. 
  - If later on we decide we want to change to Zeplin for some currently unknown reason, Figma can export to Zeplin.
  - Widely adopted

- Component creation workbench -> **Storybook**

  - Easily the most widely adopted component creation workbench in the React ecosystem

  - Can (and should) run in an npm/yarn project of its own to be completely isolated from the app(s) that consume its components

  - Also a strong collaboration tool to give a last UI/UX pass before integrating it in the dapp.

  - Multiple available addons to improve DX such as `Viewport` addon to test components in a resposive setting.

  - Huge community behind it makes it easier to learn and increases the chances contributors have already worked with it accelarating the onboarding proccess.

    

- Consumer dapp -> **Vite.js, Typescript, React Router, Styled Components**

  **Vite.js**

  - Vite.js and  is a build toolchain that does everything we need. It natively supports both react and typescript as well as transpilation through babel. The main pull of Vite.js as opposed to simply going with webpack is that it uses esbuild under the hood. esbuild is orders of magnitude faster than simply using webpack 5.
    - Vite.js uses esbuild for all the compilation/transpilation work and then uses rollup as a bundler. It has sensible defaults for our use case while allowing us to change its configuration if needed.
    - The reason it is way faster than simply using webpack is that it is not written in javascript.
    - As the application scales so does build time. Using esbuild in our toolchain (through Vite.js) makes it so build times stay manageable for the predictable future.

  **Typescript**

  - Strongly typed code bases in React (in my opinion) make a tradeoff where they lose expressiveness and conciseness for discoverability and being able to be more explicit. In a project where there will be a lot of rotating contributors being able to immediately know the shape and types of a given component's props can save some debugging time while also making the codebase easier to navigate for new contributors. So while I personally prefer vanilla ES6 I believe Typescript to be the correct choice.
    

  **React Router**

  - Seeing as the current dapp was built on next.js while we're mostly looking for an SPA as opposed to an SSG app, it would be nice to be able to have the ability to migrate the work that has been done as painlessly as possible. React Router will allow us to both navigate the app through the browser in the same way as we do today and keep the current structure of the app without forcing us to do big changes right way. 
  - React Router allows us to have 1 component per route (similarly to one file per page) without the opinionated project structure next.js imposes due to it's file based routing feature. Thus the gains are twofold: we can migrate the app without breaking the current component hierarchy and overall structure with the caveat that we are no longer being forced into file based routing. This means that as long as there is a component mapped to each route, we can strucutre the app any way we want in the future.
  
  **Styled Components**
  
  - Currently being used in the dapp
  - Widely adopted
  - CSS-in-JS is true to React's most fundamental principle (separation of concerns not separation of technologies)
  - Easy to create both reusable style mixins and components
  - Styled components are by nature extendable through the library's API
  - Non-opinionated
  
  

### Suggested workflow

1. Designer creates UI mockup in figma
2. Design is given a pass by the team
3. Mockup analyzed by the front-end team
   1. Categorize UI components in generalized/reusable components and single use components
   2. Evaluate which components already exist in the component creation workbench
   3. Assign which components should be created in the dapp and which should be created in the workbech
4. Developers create the components
5. Developers create stories/fixtures for the newly created components. They should:
   1. Reflect all envisioned states of the component
      1. Active, disabled, etc
      2. Different props such as short and long strings
      3. Variable number of children
      4. Seen in different viewports
   2. Reflect the usage of the component in the mockup as accurately as possible. This will require devs to create stories/fixtures with the new component being used alongside other existing components
6. Stories/fixtures should be given an UI/UX + code review pass by the team
7. Integrate the new component in the dapp
8. Test the UI/UX again in the dapp's development build
9. Code review for both the story/fixture, component (in case any changes had to be made) and integration gives final pass 



### **Deliverables**

​	**Figma**

- Create dapp's Figma
  - Port the currently deployed UI pages/elements
  - Port all the in-progress work
  - Prepare resources for the onboarding of new contributors
    - What are the design conventions
    - What is the flow of creation of a new UI element
    - Who are the reviewers 
  - Assign permissions new contributors + onboard them



​	**Storybook**

​	A couple of scenarios to consider:

- Single monolithic dapp

  - (This is what we currently have so not much action is needed)
  - ensure all the stories follow best practices (file naming convention, CSF, 1 storybook file per component, storybook should have same structure as the app)
  - ensure all stories are being rendered properly
  - create stories for the current pages

- Separate dapp and storybook (Monorepo approach)

  ​	This is my preferred approach as it decouples the Storybook from the dapp. It will also allow us to reuse these components in a different dapp if we decide that is something we want to do. Requires more work to setup so it might not be worth it to do it right now depending on the current deadlines, but something to consider if we want to scale our front-end horizontally in the future.

  The following points will be more of a step by step on how to do it so it represents a single deliverable

  - Move the current dapp inside a directory that should be a direct child of the current project's root.
  - Create a new directory at that same level for storybook
  - Create a new yarn project in it with the required dependencies
  - Create a directory structure for the project
    - at first a single components directory with a child directory for each component will do.
    - eventually grouping similar components by directory (i.e. buttons) will help scale the project in the right way
  - Move all the reusable components and their stories inside the storybook project
  - Ensure all the stories follow best practices (file naming convention, CSF, 1 storybook file per component, storybook should have same structure as the app)

​	After this a decision needs to be made regarding the storybook project: will it be it's own npm package with it's own versioning and thus be a dependency of the dapp? Alternatively the dapp's components can just import the storybook components directly. Depending in this decision a monorepo management tool like `Lerna` may be interesting to consider.

​	**Dapp** 

​	Dapp deliverables go beyond the design system. Please take a look at the dapp's to-do list [here](./TODO.md).