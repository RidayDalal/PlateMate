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

    // 1. Open the window IMMEDIATELY to bypass pop-up blockers
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
            <head><title>Loading ${dishName}...</title></head>
            <body style="font-family: sans-serif; padding: 2rem; display: flex; justify-content: center; align-items: center; height: 100vh;">
                <div style="text-align: center;">
                    <h2>Plating your ${dishName}...</h2>
                    <p>PlateMate AI is writing your recipe.</p>
                </div>
            </body>
        </html>
    `);

    // 2. Fetch the data from your server
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
        // 3. Inject the final content once it arrives
        win.document.body.innerHTML = `
            <style>
                body { font-family: Arial, sans-serif; background:#f9f9f9; color:#333; padding:2rem; line-height:1.6; max-width: 800px; margin: auto; }
                h1 { color:#007bff; border-bottom:1px solid #ccc; padding-bottom:0.5rem; }
                .recipe-content { background:#fff; padding:1.5rem; border:1px solid #ddd; border-radius:8px; white-space:pre-wrap; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            </style>
            <h1>${dishName}</h1>
            <div class="recipe-content">${message}</div>
        `;
        win.document.title = `${dishName} - PlateMate`;
    })
    .catch(err => {
        console.error('Error:', err);
        win.document.body.innerHTML = `<h2 style="color: red;">Failed to load recipe. Please try again.</h2>`;
    });
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
  