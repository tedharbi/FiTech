
const menuToggle = document.querySelector(".menu-toggle");
menuToggle.addEventListener("click", () => {
  const menu = document.getElementById("navMenu");
  menu.classList.toggle("show");
});
