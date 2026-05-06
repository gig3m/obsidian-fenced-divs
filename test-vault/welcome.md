# Fenced Divs Test Vault

## Class-only short form

::: note
A note block. The class name is the semantic identity.
:::

::: tip
Tips and warnings work the same way — only the class differs.
:::

## Attribute long form

:::{.warning #w1 lang=en}
Warning with id `w1` and `data-lang="en"`. Inspect the DOM to verify.
:::

:::{.aside .featured}
Multiple classes — first is primary, others ride along.
:::

## Unknown class (renders with generic framing only)

::: scripture
"In the beginning was the Word." 
:::


Add a vault CSS snippet to style this block:

```css
.ofd-block-scripture { font-style: italic; color: maroon; }
```

## Coexistence with native callouts

> [!note] Native callout
> Built-in `> [!name]` callouts coexist with `:::` fenced divs. Both render.

## Lists inside fences

A bulleted list directly inside a block:

::: materials
- Bibles for every student
- Whiteboard or large paper, markers
- Pencils, crayons or colored pencils
:::

An ordered list with prose continuation:

::: discussion
1. Why were the people so impatient?

   *Moses had been gone forty days. They didn't know if he was
   coming back.*

2. What did Aaron build?

   *A golden calf made of melted-down earrings and gold.*
:::

A list with blank lines around it (loose form):

::: note
Before the list:

- one
- two
- three

After the list.
:::

## Edge cases

A directive inside a fenced code block must NOT render:

```markdown
::: note
This is just text inside a code block.
:::
```

A nested directive — the outer matches; the inner stays as plain text in v1:

::: note
Outer body.

::: warning
Inner directive — should appear as plain `::: warning` text in v1.
:::

End of outer.
:::
