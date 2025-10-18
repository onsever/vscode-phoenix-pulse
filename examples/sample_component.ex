defmodule MyAppWeb.SampleComponent do
  use Phoenix.Component

  def button(assigns) do
    ~H"""
    <button
      phx-click={@on_click}
      phx-value-id={@id}
      phx-disable-with="Processing..."
      class={@class}
      type="button"
    >
      <%= render_slot(@inner_block) %>
    </button>
    """
  end

  def form_input(assigns) do
    ~H"""
    <div class="form-group">
      <label for={@id}>
        <%= @label %>
      </label>
      <input
        id={@id}
        name={@name}
        type={@type}
        value={@value}
        phx-debounce={@debounce || "blur"}
        phx-blur={@on_blur}
        placeholder={@placeholder}
        required={@required}
        class="form-control"
        aria-describedby={"#{@id}-help"}
      />
      <small id={"#{@id}-help"} class="form-text">
        <%= @help_text %>
      </small>
    </div>
    """
  end

  def modal(assigns) do
    ~H"""
    <div
      class="modal-backdrop"
      phx-click-away={@on_close}
      phx-window-keydown={@on_close}
      phx-key="escape"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="modal-title"><%= @title %></h2>
          <button
            phx-click={@on_close}
            aria-label="Close"
            class="close-button"
          >
            &times;
          </button>
        </div>
        <div class="modal-body">
          <%= render_slot(@inner_block) %>
        </div>
      </div>
    </div>
    """
  end

  # Example LiveView with handle_event definitions and JS commands
  defmodule MyAppWeb.ExampleLive do
    use Phoenix.LiveView
    alias Phoenix.LiveView.JS

    def mount(_params, _session, socket) do
      {:ok, assign(socket, count: 0, show_modal: false, theme: "light")}
    end

    def render(assigns) do
      ~H"""
      <div class="container">
        <h1>Phoenix LiveView with JS Commands</h1>

        <!-- Example: Simple event handler -->
        <button phx-click="increment">
          Count: {@count}
        </button>

        <!-- Example: JS commands for client-side interactions -->
        <button phx-click={show_modal_js()}>
          Open Modal (JS)
        </button>

        <!-- Example: Combining server event with JS feedback -->
        <button
          phx-click="save_data"
          phx-click={
            JS.add_class("#save-status", "loading")
            |> JS.show("#save-status")
          }
        >
          Save Data
        </button>
        <div id="save-status" style="display: none;">Saving...</div>

        <!-- Example: Toggle theme with JS -->
        <button phx-click={toggle_theme_js()}>
          Toggle Theme
        </button>

        <!-- Example: Notification system -->
        <button phx-click="show_notification">
          Show Notification (Server + JS)
        </button>
        <div id="notification" style="display: none;" class="notification"></div>
      </div>
      """
    end

    # Event handlers that will be detected by LSP
    def handle_event("increment", _params, socket) do
      {:noreply, update(socket, :count, &(&1 + 1))}
    end

    def handle_event("save_data", _params, socket) do
      # Simulate saving
      Process.sleep(1000)
      {:noreply, socket}
    end

    def handle_event("show_notification", %{"message" => message}, socket) do
      {:noreply, socket}
    end

    # Private event handler (should also be detected)
    defp handle_event("internal_action", _params, socket) do
      {:noreply, socket}
    end

    # Helper functions returning JS commands
    defp show_modal_js do
      JS.show("#modal", transition: "fade-in-scale", time: 300)
      |> JS.focus_first("#modal")
    end

    defp toggle_theme_js do
      JS.toggle_class("body", "dark-theme")
      |> JS.dispatch("theme:changed")
    end

    defp hide_notification_js do
      JS.hide("#notification", transition: "fade-out", time: 300)
      |> JS.remove_class("#notification", "show")
    end
  end
end
