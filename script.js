// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand(); // Разворачиваем на весь экран
}

const SIDES = 20;
let history = []; 
let savedSessions = JSON.parse(localStorage.getItem('d20_sessions') || '[]');

const diceDiv = document.getElementById('dice');
const tbody = document.getElementById('tbody');

// Создаём кнопки
for (let i = 1; i <= SIDES; i++) {
  const b = document.createElement('button');
  b.textContent = i;
  b.dataset.value = i;
  if (i === 1) b.classList.add('special');
  if (i === 20) b.classList.add('crit');
  
  // Легкая вибрация при нажатии
  b.addEventListener('click', () => {
    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    addRoll(i);
  });
  
  diceDiv.appendChild(b);
}

function addRoll(v) {
  history.push(v);
  render();
  saveCurrentLocal();
}

function render() {
  const counts = Array(SIDES + 1).fill(0);
  history.forEach(v => counts[v]++);
  const total = history.length;

  document.getElementById('total').textContent = total;
  document.getElementById('ones').textContent = counts[1];
  document.getElementById('twenties').textContent = counts[20];
  
  const avg = total ? (history.reduce((a,b)=>a+b,0) / total).toFixed(2) : '0';
  document.getElementById('avg').textContent = avg;

  tbody.innerHTML = '';
  const maxCount = Math.max(...counts.slice(1), 1);
  for (let i = 1; i <= SIDES; i++) {
    const cnt = counts[i];
    const pct = total ? (cnt / total * 100) : 0;
    const barW = (cnt / maxCount) * 100;
    const row = document.createElement('tr');
    let mark = (i === 1) ? ' 🔴' : (i === 20 ? ' 🟢' : '');
    row.innerHTML = `
      <td><b>${i}${mark}</b></td>
      <td>${cnt}</td>
      <td>${pct.toFixed(1)}%</td>
      <td style="color:var(--text-muted)">5.0%</td>
      <td><span class="bar" style="width:${barW}%"></span></td>`;
    tbody.appendChild(row);
  }

  analyzeStatistics(counts, total);
}

function analyzeStatistics(counts, total) {
  const block = document.getElementById('analysis-block');
  const verdictDiv = document.getElementById('verdict');
  const explainDiv = document.getElementById('explain-text');
  const chiSpan = document.getElementById('chi');

  if (total < 20) {
    block.style.display = 'none';
    chiSpan.textContent = '—';
    return;
  }

  block.style.display = 'block';

  const expected = total / SIDES;
  let chi2 = 0;
  for (let i = 1; i <= SIDES; i++) {
    chi2 += Math.pow(counts[i] - expected, 2) / expected;
  }
  chiSpan.textContent = chi2.toFixed(2);

  let verdictClass = '';
  let verdictText = '';
  let explanation = '';

  const onesPct = (counts[1] / total * 100);
  const twentiesPct = (counts[20] / total * 100);
  const isLucky = (counts[20] > expected * 1.5) && (counts[1] < expected * 0.5);
  const isUnlucky = (counts[1] > expected * 1.5) && (counts[20] < expected * 0.5);

  if (chi2 > 36.19) {
    verdictClass = 'v-red';
    verdictText = '🚨 Кубик смещён (нечестный)';
    explanation = `Значение χ² (${chi2.toFixed(2)}) превышает критическую отметку 36.19. Вероятность такого распределения у честного кубика менее 1%. Скорее всего, внутри есть дефект, который выталкивает определенные числа. Рекомендую заменить кубик.`;
  } else if (chi2 > 30.14) {
    verdictClass = 'v-yellow';
    verdictText = '⚠️ Есть подозрительные отклонения';
    explanation = `Значение χ² (${chi2.toFixed(2)}) больше 30.14. Вероятность случайности менее 5%. Пока рано делать выводы, но я бы советовал сделать еще 100-200 бросков. Если χ² продолжит расти — кубик лучше заменить.`;
  } else {
    if (isLucky) {
      verdictClass = 'v-green';
      verdictText = '🍀 Кубик «везучий» (но честный)';
      explanation = `По общему распределению (χ² = ${chi2.toFixed(2)}) кубик абсолютно честный. Однако двадцатка выпадает подозрительно часто (${twentiesPct.toFixed(1)}%), а единица — редко. Скорее всего, это случайность, но если так будет продолжаться — можно считать его счастливым!`;
    } else if (isUnlucky) {
      verdictClass = 'v-yellow';
      verdictText = '🌧 Кубик «невезучий» (но честный)';
      explanation = `По общему распределению (χ² = ${chi2.toFixed(2)}) кубик честный. Но тебе не везет на криты: единица выпадает часто (${onesPct.toFixed(1)}%), а двадцатка почти не появляется (${twentiesPct.toFixed(1)}%). Статистически это допустимо, но для игры лучше не бросать важные спасброски!`;
    } else {
      verdictClass = 'v-green';
      verdictText = '✅ Кубик сбалансированный (честный)';
      explanation = `Значение χ² (${chi2.toFixed(2)}) находится в пределах нормы. Отклонения — нормальный математический шум. Кубик ведёт себя как идеальный генератор случайных чисел. Бросай спокойно!`;
    }
  }

  verdictDiv.className = 'verdict-box ' + verdictClass;
  verdictDiv.textContent = verdictText;
  explanation += `<br><br><i>Твой χ² = <b>${chi2.toFixed(2)}</b>. У идеального кубика он обычно 10–25. Если выше 30.14 — повод насторожиться, если выше 36.19 — кубик с дефектом.</i>`;
  explainDiv.innerHTML = explanation;
}

// --- Логика сохранений ---
function renderSessions() {
  const list = document.getElementById('sessions-list');
  list.innerHTML = '';
  savedSessions.forEach((session, index) => {
    const li = document.createElement('li');
    const dateStr = new Date(session.date).toLocaleString('ru-RU', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
    li.innerHTML = `
      <div class="s-info">
        <b>${session.name}</b><br>
        <span style="color:var(--text-muted); font-size:12px;">${session.history.length} бр. | ${dateStr}</span>
      </div>
      <div class="s-actions">
        <button class="s-load" onclick="loadSession(${index})">Загрузить</button>
        <button class="s-del" onclick="deleteSession(${index})">✖</button>
      </div>
    `;
    list.appendChild(li);
  });
}

document.getElementById('btn-save').addEventListener('click', () => {
  if (history.length === 0) {
    alert("Нет бросков для сохранения!"); return;
  }
  const nameInput = document.getElementById('session-name');
  const name = nameInput.value.trim() || `Сессия от ${new Date().toLocaleDateString()}`;
  
  savedSessions.push({
    name: name,
    date: Date.now(),
    history: [...history]
  });
  
  localStorage.setItem('d20_sessions', JSON.stringify(savedSessions));
  nameInput.value = '';
  renderSessions();
});

window.loadSession = function(index) {
  if(confirm("Загрузить эту сессию? Текущие несохраненные броски будут перезаписаны.")) {
    history = [...savedSessions[index].history];
    render();
    saveCurrentLocal();
  }
};

window.deleteSession = function(index) {
  if(confirm("Удалить эту сессию навсегда?")) {
    savedSessions.splice(index, 1);
    localStorage.setItem('d20_sessions', JSON.stringify(savedSessions));
    renderSessions();
  }
};

function saveCurrentLocal() {
  localStorage.setItem('d20_current', JSON.stringify(history));
}
function loadCurrentLocal() {
  try {
    const raw = localStorage.getItem('d20_current');
    if (raw) history = JSON.parse(raw) || [];
  } catch(e) { history = []; }
}

document.getElementById('undo').addEventListener('click', () => {
  history.pop(); render(); saveCurrentLocal();
});
document.getElementById('reset').addEventListener('click', () => {
  if (history.length && confirm('Очистить текущие броски? (Сохраненные сессии не удалятся)')) {
    history = []; render(); saveCurrentLocal();
  }
});

// --- Логика модального окна ---
const modal = document.getElementById('help-modal');
const btnHelp = document.getElementById('btn-help');
const closeHelp = document.getElementById('close-help');

btnHelp.onclick = () => modal.style.display = 'block';
closeHelp.onclick = () => modal.style.display = 'none';
window.onclick = (event) => {
  if (event.target === modal) modal.style.display = 'none';
}

// Инициализация
loadCurrentLocal();
render();
renderSessions();