/* 1.  SEARCH FOR RECIPES  */
document.getElementById('searchBtn').addEventListener('click', () => {
    const ingredients = document.getElementById('ingredients').value;
    const selectedDiet = document.querySelector('input[name="diet"]:checked').value;
    const selectedCuisine = document.getElementById('cuisineSelect').value; 
    const selectedPeople = document.getElementById('peopleCount').value;
    const requestData = {
        ingredients,
        diet: selectedDiet,
        cuisine: selectedCuisine,
        people: selectedPeople
      };
    
    // Send to backend
  fetch('/find-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  })
    .then(response => response.json())
    .then(data => displayRecipes(data.recipes))
    .catch(error => console.error('Error:', error));
  });
  
  /* 2.  RENDER RECIPE CARDS  */
  function displayRecipes(recipes) {
    const list = document.getElementById('recipesList');
    list.innerHTML = '';
  
    recipes.forEach(r => {
      const card = document.createElement('div');
      card.className = 'recipe-item';
      card.textContent = r.name;
      card.addEventListener('click', () => handleDishClick(r.name, r.missingIngredients || []));
      list.appendChild(card);
    });
  }
  
  /* 3.  WHEN A DISH IS CLICKED, OPEN RESULT IN NEW TAB  */
  function handleDishClick(dishName, missingIngredients) {
    const userIngredients = document.getElementById('ingredients').value;
  
    fetch('/explain-dish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dish: dishName,
        inputIngredients: userIngredients,
        missingIngredients
      })
    })
      .then(r => r.json())
      .then(({ message }) => {
        /* Open a new tab and inject formatted HTML */
        const win = window.open('', '_blank');
        win.document.write(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <title>${dishName} – Kitchen Assistant</title>
            <style>
              body   { font-family: Arial, sans-serif; background:#f9f9f9; color:#333; padding:2rem; line-height:1.6; }
              h1     { color:#007bff; margin-top:0; border-bottom:1px solid #ccc; padding-bottom:0.5rem; }
              pre    { background:#fff; padding:1rem; border:1px solid #ddd; border-radius:8px; white-space:pre-wrap; }
            </style>
          </head>
          <body>
            <h1>${dishName}</h1>
            <pre>${message}</pre>
          </body>
          </html>
        `);
        win.document.close();
      })
      .catch(err => console.error('Error:', err));
  }

  document.getElementById('plusBtn').addEventListener('click', () => {
    const countEl = document.getElementById('peopleCount');
    countEl.textContent = parseInt(countEl.textContent, 10) + 1;
  });
  
  document.getElementById('minusBtn').addEventListener('click', () => {
    const countEl = document.getElementById('peopleCount');
    const current = parseInt(countEl.textContent, 10);
    if (current > 1) countEl.textContent = current - 1;
  });
  