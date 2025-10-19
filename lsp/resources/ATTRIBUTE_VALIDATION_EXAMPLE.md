# Attribute Value Validation Example

This document shows examples of the new attribute value validation feature.

## Feature: Validate Attribute Values Against Allowed Values

When a component defines an attribute with specific allowed values using the `values:` option, the LSP will now validate that usage matches one of the allowed values.

### Example Component Definition

```elixir
defmodule MyAppWeb.Components.Button do
  use Phoenix.Component

  attr :variant, :string, values: ["primary", "secondary", "danger"], default: "primary"
  attr :size, :string, values: ["sm", "md", "lg"], default: "md"

  def button(assigns) do
    ~H"""
    <button class={["btn", "btn-#{@variant}", "btn-#{@size}"]}>
      <%= render_slot(@inner_block) %>
    </button>
    """
  end
end
```

### Valid Usage (No warnings)

```heex
<.button variant="primary" size="md">Click me</.button>
<.button variant="secondary">Click me</.button>
<.button size="lg">Click me</.button>
```

### Invalid Usage (Shows warnings)

```heex
<!-- ⚠️ Warning: Invalid value "blue" for attribute "variant". Expected one of: "primary", "secondary", "danger". -->
<.button variant="blue">Click me</.button>

<!-- ⚠️ Warning: Invalid value "xlarge" for attribute "size". Expected one of: "sm", "md", "lg". -->
<.button size="xlarge">Click me</.button>
```

### Dynamic Expressions (Not validated - runtime value)

```heex
<!-- No validation - dynamic expression -->
<.button variant={@user_preference}>Click me</.button>

<!-- No validation - Elixir expression -->
<.button size={if @large, do: "lg", else: "sm"}>Click me</.button>
```

## Technical Details

- Validation only applies to **string literals** and **atom literals** (`:primary`)
- Dynamic expressions like `{@variant}` are not validated (runtime values)
- Warnings are shown at the attribute value position
- This works for any component attribute that defines `values: [...]`

## Diagnostic Code

The diagnostic code is: `component-invalid-attribute-value`

You can suppress these warnings by adding comments or adjusting your component definitions.
