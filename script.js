document.addEventListener("DOMContentLoaded", () => {
  const orderForm = document.getElementById("orderForm");
  const orderList = document.getElementById("orderList");

  // Load orders from localStorage
  let orders = JSON.parse(localStorage.getItem("orders")) || [];

  function saveOrders() {
    localStorage.setItem("orders", JSON.stringify(orders));
  }

  // Add Order
  if (orderForm) {
    orderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const customer = document.getElementById("customerName").value;
      const name = document.getElementById("orderName").value;
      const qty = document.getElementById("orderQty").value;
      const deadline = document.getElementById("orderDeadline").value;

      orders.push({ customer, name, qty, deadline, done: false });
      saveOrders();
      orderForm.reset();
      alert("✅ Order added successfully!");
    });
  }

  // Render Orders
  if (orderList) {
    function renderOrders() {
      orderList.innerHTML = "";
      orders.forEach((order, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>
            <strong>Customer:</strong> ${order.customer} <br>
            <strong>Item:</strong> ${order.name} (x${order.qty}) <br>
            <strong>Deadline:</strong> ${order.deadline}
          </span>
          <button onclick="markDone(${index})">Mark as Done</button>
        `;
        orderList.appendChild(li);
      });
    }
    renderOrders();

    // Expose for inline button
    window.markDone = function(index) {
      const confirmDelete = confirm("Mark this order as done and remove it?");
      if (confirmDelete) {
        orders.splice(index, 1);
        saveOrders();
        renderOrders();
      }
    };
  }
});
