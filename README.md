# Hypercalculator

A visual math-object workbench built with React, TypeScript, Vite, Three.js, Math.js, and lucide-react.

The current prototype treats expressions as mathematical objects with matching analysis and visualization:

- a macOS-inspired calculator window
- stable 2D graphing for algebraic functions like `x^2 - 4`
- root solving over `[-10, 10]`
- symbolic derivative and antiderivative modes powered by Nerdamer
- signed integral-area context over `[-2, 2]`
- vector input such as `<3, 4>`
- complex number input such as `3 + 4i`
- surface visualization for two-variable functions like `sin(x) * cos(y)`
- optional orbit for 3D objects
- concept-aware example generation for same type, easier, harder, and surprise prompts
- a dense scientific keypad with memory, angle mode, history, and keyboard input

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Verify

```bash
npm run lint
npm run build
```
