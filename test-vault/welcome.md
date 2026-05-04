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
"In the beginning was the Word." Add a vault CSS snippet to style this block:

```css
.ofd-block-scripture { font-style: italic; color: maroon; }
```
:::

## Coexistence with native callouts

> [!note] Native callout
> Built-in `> [!name]` callouts coexist with `:::` fenced divs. Both render.

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
