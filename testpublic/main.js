const menuToggle = document.querySelector(".menu-toggle");
menuToggle.addEventListener("click", () => {
  const menu = document.getElementById("navMenu");
  menu.classList.toggle("show");
});

// Logo click handler to ensure it goes to home
document.querySelector("header a").addEventListener("click", function (e) {
  // Already has href="/" so it will navigate to home
  // This is just to confirm functionality
  console.log("Navigating to home page");
});
