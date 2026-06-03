/**
 * AuraQuiz — Main Application Engine
 */

// --- Application State ---
const state = {
  apiKey: '',
  model: 'gemini-2.5-flash',
  difficulty: 'Medium',
  topic: '',
  questions: [],
  currentQuestionIndex: 0,
  userAnswers: [], // stores the selected index (0-3) or null if timed out
  score: 0,
  timeLeft: 30,
  timerInterval: null,
  selectedOptionIndex: null, // option selected for the current question
  isTransitioning: false, // avoids double advance inputs
};

// --- DOM Elements ---
const elements = {
  // Theme
  themeToggle: document.getElementById('theme-toggle'),
  themeToggleIcon: document.querySelector('#theme-toggle i'),
  
  // Screens
  setupScreen: document.getElementById('setup-screen'),
  loadingScreen: document.getElementById('loading-screen'),
  quizScreen: document.getElementById('quiz-screen'),
  resultsScreen: document.getElementById('results-screen'),
  
  // Setup Form
  setupForm: document.getElementById('quiz-setup-form'),
  apiKeyInput: document.getElementById('api-key'),
  toggleKeyVisibility: document.getElementById('toggle-key-visibility'),
  aiModelSelect: document.getElementById('ai-model'),
  difficultySelect: document.getElementById('difficulty'),
  topicInput: document.getElementById('quiz-topic'),
  suggestionTags: document.querySelectorAll('.suggestion-tag'),
  
  // Loading screen
  loadingTitle: document.getElementById('loading-title'),
  loadingStatus: document.getElementById('loading-status'),
  loadingProgress: document.getElementById('loading-progress'),
  
  // Quiz screen
  currentQuestionNum: document.getElementById('current-question-num'),
  totalQuestionsNum: document.getElementById('total-questions-num'),
  timerProgress: document.getElementById('timer-progress'),
  timerText: document.getElementById('timer-text'),
  questionText: document.getElementById('question-text'),
  optionsGrid: document.getElementById('options-grid'),
  hintToggleBtn: document.getElementById('hint-toggle-btn'),
  hintContainer: document.querySelector('.hint-container'),
  hintText: document.getElementById('hint-text'),
  nextQuestionBtn: document.getElementById('next-question-btn'),
  
  // Results screen
  resultIcon: document.getElementById('result-icon'),
  resultGreeting: document.getElementById('result-greeting'),
  resultTopicDisplay: document.getElementById('result-topic-display'),
  scoreFraction: document.getElementById('score-fraction'),
  scorePercentage: document.getElementById('score-percentage'),
  scoreGaugeBar: document.getElementById('score-gauge-bar'),
  resultFeedback: document.getElementById('result-feedback'),
  restartQuizBtn: document.getElementById('restart-quiz-btn'),
  reviewList: document.getElementById('review-list'),
  
  // Error Modal
  errorModal: document.getElementById('error-modal'),
  errorMessage: document.getElementById('error-message'),
  errorTechnicalLog: document.getElementById('error-technical-log'),
  errorDetailsContainer: document.getElementById('error-details-container'),
  closeErrorBtn: document.getElementById('close-error-btn'),
  playDemoBtn: document.getElementById('play-demo-btn'),
  
  // Toast container
  toastContainer: document.getElementById('toast-container'),
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSavedSettings();
  setupEventListeners();
});

// --- Theme Toggle Logic ---
function initTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  updateThemeUI(currentTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('aura-quiz-theme', newTheme);
  updateThemeUI(newTheme);
  
  showToast(`Switched to ${newTheme} theme`, 'info');
}

function updateThemeUI(theme) {
  if (theme === 'dark') {
    elements.themeToggleIcon.className = 'fa-solid fa-sun';
  } else {
    elements.themeToggleIcon.className = 'fa-solid fa-moon';
  }
}

// --- Local Storage Management ---
function loadSavedSettings() {
  const savedKey = localStorage.getItem('aura-quiz-key');
  if (savedKey) {
    elements.apiKeyInput.value = savedKey;
    showToast('Loaded saved API Key', 'success');
  }
  
  const savedModel = localStorage.getItem('aura-quiz-model');
  if (savedModel) {
    elements.aiModelSelect.value = savedModel;
  }
}

function saveSettings(key, model) {
  localStorage.setItem('aura-quiz-key', key);
  localStorage.setItem('aura-quiz-model', model);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Theme Toggle
  elements.themeToggle.addEventListener('click', toggleTheme);
  
  // API Key visibility toggle
  elements.toggleKeyVisibility.addEventListener('click', () => {
    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    elements.toggleKeyVisibility.querySelector('i').className = isPassword 
      ? 'fa-solid fa-eye-slash' 
      : 'fa-solid fa-eye';
  });
  
  // Topic suggestions tags
  elements.suggestionTags.forEach(tag => {
    tag.addEventListener('click', () => {
      elements.topicInput.value = tag.textContent;
      elements.topicInput.focus();
    });
  });
  
  // Setup form submission
  elements.setupForm.addEventListener('submit', handleSetupSubmit);
  
  // Hint Accordion toggle
  elements.hintToggleBtn.addEventListener('click', () => {
    elements.hintContainer.classList.toggle('expanded');
  });
  
  // Next question action
  elements.nextQuestionBtn.addEventListener('click', handleNextQuestion);
  
  // Restart Quiz
  elements.restartQuizBtn.addEventListener('click', resetQuiz);
  
  // Error modal dismiss
  elements.closeErrorBtn.addEventListener('click', () => {
    elements.errorModal.classList.remove('active');
    if (elements.loadingScreen.classList.contains('active')) {
      switchScreen(elements.loadingScreen, elements.setupScreen);
    }
  });

  // Play offline demo mode button from error modal
  elements.playDemoBtn.addEventListener('click', () => {
    loadOfflineQuiz();
  });
}

// --- Toast System ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-triangle-exclamation';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Remove toast from DOM after animations complete (3 seconds total)
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// --- Setup Form Submission Handler ---
async function handleSetupSubmit(e) {
  e.preventDefault();
  
  const apiKey = elements.apiKeyInput.value.trim();
  const model = elements.aiModelSelect.value;
  const difficulty = elements.difficultySelect.value;
  const topic = elements.topicInput.value.trim();
  
  if (!topic) {
    showToast('Please enter a Quiz Topic', 'error');
    return;
  }
  
  // Save credentials/configs (if API key provided)
  if (apiKey) {
    saveSettings(apiKey, model);
  } else {
    localStorage.setItem('aura-quiz-model', model);
  }
  
  // Update app state
  state.apiKey = apiKey;
  state.model = model;
  state.difficulty = difficulty;
  state.topic = topic;
  
  // Transition to loading screen
  switchScreen(elements.setupScreen, elements.loadingScreen);
  
  if (!apiKey) {
    updateLoadingProgress(40, 'Offline Demo Mode Selected...', 'Configuring built-in quiz modules...');
    setTimeout(() => {
      loadOfflineQuiz();
    }, 1200);
    return;
  }
  
  updateLoadingProgress(25, 'Formulating structured prompt...', 'Synthesizing layout requirements...');
  
  try {
    const quizData = await fetchQuizFromGemini(apiKey, model, topic, difficulty);
    state.questions = quizData.questions;
    
    // Safety check on response
    if (!state.questions || state.questions.length !== 5) {
      throw new Error(`Expected exactly 5 questions, but received ${state.questions ? state.questions.length : 0}`);
    }
    
    updateLoadingProgress(90, 'Validating question structures...', 'Formatting multiple choices...');
    
    setTimeout(() => {
      // Transition to quiz view
      switchScreen(elements.loadingScreen, elements.quizScreen);
      startQuiz();
    }, 800);
    
  } catch (error) {
    console.error("Gemini API Error, falling back to offline quiz:", error);
    showToast(`Gemini API Failed: ${error.message || error}. Loading Offline Quiz instead!`, "error");
    
    // Auto-advance to Offline Quiz after a 2-second explanation delay
    updateLoadingProgress(60, 'API Error Detected...', 'Redirecting to built-in quiz modules...');
    setTimeout(() => {
      loadOfflineQuiz();
    }, 2000);
  }
}

// --- Screen Switching Helper ---
function switchScreen(fromScreen, toScreen) {
  fromScreen.classList.remove('active');
  fromScreen.style.display = 'none';
  
  toScreen.style.display = 'block';
  // Allow layout paint before triggering transition class
  setTimeout(() => {
    toScreen.classList.add('active');
  }, 50);
}

// --- Update Loading UI ---
function updateLoadingProgress(percentage, title, status) {
  elements.loadingProgress.style.width = `${percentage}%`;
  if (title) elements.loadingTitle.textContent = title;
  if (status) elements.loadingStatus.textContent = status;
}

// --- Gemini AI Interface ---
async function fetchQuizFromGemini(apiKey, model, topic, difficulty) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const systemInstructions = `
    Generate a quiz with exactly 5 multiple choice questions on the topic "${topic}" and difficulty level "${difficulty}".
    The target audience is testing their knowledge on this topic.
    You must output a JSON object adhering to this schema:
    {
      "questions": [
        {
          "question": "The text of the question",
          "options": [
            "Option A",
            "Option B",
            "Option C",
            "Option D"
          ],
          "correctAnswer": 0, // integer index (0-3) of the correct option
          "hint": "A short, helpful hint to guide the user without revealing the direct answer.",
          "explanation": "A concise explanation of why this option is correct."
        }
      ]
    }
    Make sure:
    - There are exactly 5 questions.
    - Each question has exactly 4 options.
    - correctAnswer is an integer from 0 to 3.
    - The language is English.
    - Questions match the difficulty: "${difficulty}".
    - The JSON output must be strictly valid JSON. Do not wrap in markdown or backticks.
  `;
  
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: systemInstructions
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };
  
  updateLoadingProgress(55, 'Prompting Gemini AI...', 'Synthesizing quiz variables...');
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    let errorMessage = `HTTP Error Code: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error && errorData.error.message) {
        errorMessage = errorData.error.message;
      }
    } catch (_) {
      // Body not json, continue with default error message
    }
    throw new Error(`Gemini API error: ${errorMessage}`);
  }
  
  const responseData = await response.json();
  
  try {
    const rawJsonText = responseData.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(rawJsonText);
    return parsedData;
  } catch (err) {
    console.error("Gemini Response parsing failed", responseData, err);
    throw new Error(`Failed to parse response JSON: ${err.message}. Raw AI Output could not be decoded as the expected Quiz Schema.`);
  }
}

// --- Error Modal Trigger ---
function showErrorModal(error) {
  let message = error.message || 'An unexpected error occurred during quiz generation.';
  
  // Format clear helpful diagnostic info
  if (message.includes('denied access') || message.includes('PERMISSION_DENIED')) {
    message = `Google API Permission Denied (403): Your Gemini project or account has been restricted or denied access. This is a platform-side block that often affects certain regions, Google Workspace accounts, or projects without verified age. Please try creating a brand-new project and fresh key in Google AI Studio.`;
  } else if (message.includes('quota') || message.includes('quota exceeded') || message.includes('RESOURCE_EXHAUSTED') || message.includes('limit: 0')) {
    message = `Google API Quota Exceeded (429): Your Gemini API key has a free tier quota limit of 0. To resolve this, you can verify your billing details or create a new project in Google AI Studio using a different Google account.`;
  }
  
  elements.errorMessage.textContent = message;
  elements.errorTechnicalLog.textContent = error.stack || String(error);
  elements.errorDetailsContainer.open = false;
  elements.errorModal.classList.add('active');
}

// --- Quiz Engine Logic ---
function startQuiz() {
  state.currentQuestionIndex = 0;
  state.userAnswers = [];
  state.score = 0;
  state.isTransitioning = false;
  
  elements.totalQuestionsNum.textContent = state.questions.length;
  
  renderQuestion();
}

function renderQuestion() {
  state.selectedOptionIndex = null;
  state.isTransitioning = false;
  elements.nextQuestionBtn.disabled = true;
  elements.nextQuestionBtn.querySelector('span').textContent = 
    state.currentQuestionIndex === state.questions.length - 1 ? 'Finish Quiz' : 'Next Question';
  
  const question = state.questions[state.currentQuestionIndex];
  
  // Collapse hint drawer
  elements.hintContainer.classList.remove('expanded');
  elements.hintText.textContent = question.hint || 'No hint available for this question.';
  
  // Update Question UI
  elements.currentQuestionNum.textContent = state.currentQuestionIndex + 1;
  elements.questionText.textContent = question.question;
  
  // Populating options
  elements.optionsGrid.innerHTML = '';
  question.options.forEach((optionText, idx) => {
    const optionCard = document.createElement('button');
    optionCard.type = 'button';
    optionCard.className = 'option-card animated scale-in';
    optionCard.style.animationDelay = `${idx * 0.08}s`;
    
    const letter = String.fromCharCode(65 + idx); // A, B, C, D
    optionCard.innerHTML = `
      <span class="option-badge">${letter}</span>
      <span class="option-content">${escapeHTML(optionText)}</span>
    `;
    
    optionCard.addEventListener('click', () => handleOptionSelect(idx, optionCard));
    elements.optionsGrid.appendChild(optionCard);
  });
  
  // Start Timer
  startTimer();
}

// Helper to escape HTML and prevent injection issues from AI responses
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- Choice Selection ---
function handleOptionSelect(index, selectedCard) {
  if (state.isTransitioning) return; // ignore choices during countdown timeout/transition
  
  state.selectedOptionIndex = index;
  
  // Clear select styles on all cards
  const allCards = elements.optionsGrid.querySelectorAll('.option-card');
  allCards.forEach(card => card.classList.remove('selected'));
  
  // Highlight chosen card
  selectedCard.classList.add('selected');
  
  // Enable Next button
  elements.nextQuestionBtn.disabled = false;
}

// --- Timer System ---
function startTimer() {
  clearInterval(state.timerInterval);
  state.timeLeft = 30;
  updateTimerUI();
  
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerUI();
    
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      handleTimerTimeout();
    }
  }, 1000);
}

function updateTimerUI() {
  elements.timerText.textContent = state.timeLeft;
  
  // Circumference = 163.36
  const circumference = 163.36;
  const offset = circumference * (1 - (state.timeLeft / 30));
  elements.timerProgress.style.strokeDashoffset = offset;
  
  // Color warnings
  elements.timerProgress.classList.remove('warning', 'danger');
  if (state.timeLeft <= 5) {
    elements.timerProgress.classList.add('danger');
  } else if (state.timeLeft <= 15) {
    elements.timerProgress.classList.add('warning');
  }
}

// --- Timer Expiration ---
function handleTimerTimeout() {
  state.isTransitioning = true;
  showToast("Time's up!", 'error');
  
  // Lock options from click
  const allCards = elements.optionsGrid.querySelectorAll('.option-card');
  allCards.forEach(card => card.classList.add('locked'));
  
  // If user selected something before timer ran out, keep it
  const finalSelectedIndex = state.selectedOptionIndex;
  const correctIdx = state.questions[state.currentQuestionIndex].correctAnswer;
  
  // Visual feedback: reveal correct/incorrect answer
  allCards.forEach((card, idx) => {
    if (idx === correctIdx) {
      card.classList.add('correct');
    } else if (idx === finalSelectedIndex) {
      card.classList.add('wrong');
    }
  });
  
  // Auto-reveal hint/explanation details if they want to peek
  elements.hintContainer.classList.add('expanded');
  
  // Auto transition to next question after a 2.5 second reading window
  setTimeout(() => {
    commitAnswerAndAdvance(finalSelectedIndex);
  }, 2500);
}

// --- Next Button Click Handler ---
function handleNextQuestion() {
  if (state.isTransitioning) return;
  clearInterval(state.timerInterval);
  
  const finalSelectedIndex = state.selectedOptionIndex;
  commitAnswerAndAdvance(finalSelectedIndex);
}

// --- Commit answer and determine progression ---
function commitAnswerAndAdvance(selectedIndex) {
  state.userAnswers.push(selectedIndex);
  
  // Increment Score if correct
  const correctIdx = state.questions[state.currentQuestionIndex].correctAnswer;
  if (selectedIndex === correctIdx) {
    state.score++;
  }
  
  state.currentQuestionIndex++;
  
  if (state.currentQuestionIndex < state.questions.length) {
    renderQuestion();
  } else {
    evaluateQuizAndDisplay();
  }
}

// --- Evaluation & Dashboard Reveal ---
function evaluateQuizAndDisplay() {
  switchScreen(elements.quizScreen, elements.resultsScreen);
  
  elements.resultTopicDisplay.textContent = `Topic: ${state.topic}`;
  
  const totalQuestions = state.questions.length;
  elements.scoreFraction.textContent = `${state.score}/${totalQuestions}`;
  
  const scorePercent = Math.round((state.score / totalQuestions) * 100);
  elements.scorePercentage.textContent = `${scorePercent}%`;
  
  // Animate Gauge Bar (Circumference: 439.82)
  const circumference = 439.82;
  const offset = circumference * (1 - (state.score / totalQuestions));
  
  // Small timeout to allow render paint before animation begins
  setTimeout(() => {
    elements.scoreGaugeBar.style.strokeDashoffset = offset;
  }, 100);
  
  // Layout updates based on result performance
  elements.resultIcon.classList.remove('failed');
  if (state.score === totalQuestions) {
    elements.resultIcon.className = 'celebration-icon';
    elements.resultIcon.innerHTML = '<i class="fa-solid fa-trophy"></i>';
    elements.resultGreeting.textContent = 'Spectacular Score!';
    elements.resultFeedback.textContent = 'Absolute perfection! You have demonstrated exhaustive knowledge and mastery of this subject.';
  } else if (state.score >= 3) {
    elements.resultIcon.className = 'celebration-icon';
    elements.resultIcon.innerHTML = '<i class="fa-solid fa-medal"></i>';
    elements.resultGreeting.textContent = 'Excellent Job!';
    elements.resultFeedback.textContent = 'Impressive performance! You possess a robust foundation in this field of study.';
  } else {
    elements.resultIcon.className = 'celebration-icon failed';
    elements.resultIcon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    elements.resultGreeting.textContent = 'Keep Learning!';
    elements.resultFeedback.textContent = 'Every mistake is a portal of discovery. Revisit this topic and try again to boost your score.';
  }
  
  // Build detailed review checklist
  buildDetailedReviewList();
}

function buildDetailedReviewList() {
  elements.reviewList.innerHTML = '';
  
  state.questions.forEach((question, index) => {
    const userAnswerIndex = state.userAnswers[index];
    const correctAnswerIndex = question.correctAnswer;
    const isCorrect = userAnswerIndex === correctAnswerIndex;
    
    const reviewItem = document.createElement('div');
    reviewItem.className = 'review-item';
    
    // Status Icon
    const statusIconClass = isCorrect ? 'fa-check' : 'fa-xmark';
    const badgeClass = isCorrect ? 'correct' : 'wrong';
    
    let choicesMarkup = '';
    question.options.forEach((optionText, optIdx) => {
      let optionClass = '';
      let optionIcon = '';
      
      if (optIdx === correctAnswerIndex) {
        optionClass = 'correct-choice';
        optionIcon = '<i class="fa-solid fa-circle-check"></i>';
      } else if (optIdx === userAnswerIndex) {
        optionClass = 'user-selected wrong-choice';
        optionIcon = '<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i>';
      }
      
      choicesMarkup += `
        <div class="review-choice ${optionClass}">
          ${optionIcon || '<i class="fa-regular fa-circle"></i>'}
          <span>${escapeHTML(optionText)}</span>
        </div>
      `;
    });
    
    let userSelectionText = '';
    if (userAnswerIndex === null || userAnswerIndex === undefined) {
      userSelectionText = '<span style="color:var(--danger); font-weight:600">Timed Out</span>';
    } else {
      const char = String.fromCharCode(65 + userAnswerIndex);
      userSelectionText = `Choice <strong>${char}</strong>`;
    }
    
    reviewItem.innerHTML = `
      <div class="review-item-header">
        <div class="review-status-badge ${badgeClass}">
          <i class="fa-solid ${statusIconClass}"></i>
        </div>
        <h4>${index + 1}. ${escapeHTML(question.question)}</h4>
      </div>
      <div class="review-choices">
        ${choicesMarkup}
      </div>
      <div class="review-explanation">
        <p><strong>Your Answer:</strong> ${userSelectionText}</p>
        <p style="margin-top: 6px;"><strong>Explanation:</strong> ${escapeHTML(question.explanation || 'No explanation provided.')}</p>
      </div>
    `;
    
    elements.reviewList.appendChild(reviewItem);
  });
}

// --- Reset & Retry Quiz ---
function resetQuiz() {
  state.questions = [];
  state.currentQuestionIndex = 0;
  state.userAnswers = [];
  state.score = 0;
  
  // Clear input variables
  elements.topicInput.value = '';
  
  // Return to Setup screen
  switchScreen(elements.resultsScreen, elements.setupScreen);
  showToast('Ready for new quiz generation', 'info');
}

// --- Offline / Demo Mode Quiz Repository ---
const OFFLINE_QUIZZES = {
  "quantum physics": {
    topic: "Quantum Physics",
    questions: [
      {
        question: "What is the basic unit of light or electromagnetic radiation?",
        options: ["Electron", "Proton", "Photon", "Neutron"],
        correctAnswer: 2,
        hint: "Think about the particle that carries light.",
        explanation: "A photon is the elementary particle of light, representing a quantum of light or other electromagnetic radiation."
      },
      {
        question: "Which quantum physics principle states that you cannot simultaneously measure a particle's position and momentum with perfect precision?",
        options: ["Schrödinger's Equation", "Heisenberg Uncertainty Principle", "Planck's Constant", "Wave-Particle Duality"],
        correctAnswer: 1,
        hint: "It represents fundamental uncertainty in quantum states.",
        explanation: "The Heisenberg Uncertainty Principle states that the more precisely the position of some particle is determined, the less precisely its momentum can be known, and vice versa."
      },
      {
        question: "What phenomenon occurs when pairs or groups of particles interact in ways such that the quantum state of each particle cannot be described independently of the state of the others, even when separated by a large distance?",
        options: ["Quantum Tunneling", "Quantum Entanglement", "Superposition", "Radioactive Decay"],
        correctAnswer: 1,
        hint: "Einstein famously referred to this as 'spooky action at a distance'.",
        explanation: "Quantum Entanglement is a physical phenomenon that occurs when pairs or groups of particles are generated, interact, or share spatial proximity in ways such that the quantum state of each particle cannot be described independently."
      },
      {
        question: "Which physicist proposed that matter has wave-like properties, leading to the concept of wave-particle duality?",
        options: ["Albert Einstein", "Niels Bohr", "Louis de Broglie", "Richard Feynman"],
        correctAnswer: 2,
        hint: "His name sounds French.",
        explanation: "Louis de Broglie proposed the wave-particle duality hypothesis in 1924, suggesting that all matter, not just light, has wave-like characteristics."
      },
      {
        question: "In the famous Schrödinger's Cat thought experiment, the cat is in a state of being both alive and dead simultaneously until observed. What is this state called?",
        options: ["Entanglement", "Coherence", "Superposition", "Decoherence"],
        correctAnswer: 2,
        hint: "It refers to adding multiple possible states together.",
        explanation: "Superposition is a principle in quantum mechanics that states any two (or more) quantum states can be added together and the result will be another valid quantum state."
      }
    ]
  },
  "ancient rome": {
    topic: "Ancient Rome",
    questions: [
      {
        question: "Who was the first official Emperor of the Roman Empire, ruling from 27 BC until his death in 14 AD?",
        options: ["Julius Caesar", "Nero", "Augustus Caesar", "Marcus Aurelius"],
        correctAnswer: 2,
        hint: "He was originally named Octavian and was Julius Caesar's adopted son.",
        explanation: "Augustus Caesar was the first Emperor of the Roman Empire. His reign initiated the Pax Romana, a period of relative peace."
      },
      {
        question: "Which Roman city was famously destroyed and preserved under layers of volcanic ash during the eruption of Mount Vesuvius in 79 AD?",
        options: ["Carthage", "Pompeii", "Alexandria", "Athens"],
        correctAnswer: 1,
        hint: "It is located in modern-day Italy near Naples.",
        explanation: "Pompeii was an ancient Roman city near modern Naples that was buried under 4 to 6 meters of volcanic ash and pumice in the eruption of Mount Vesuvius in 79 AD."
      },
      {
        question: "The massive oval amphitheatre in the centre of the city of Rome, built under the Flavian dynasty, is commonly known by what name?",
        options: ["Colosseum", "Pantheon", "Circus Maximus", "Roman Forum"],
        correctAnswer: 0,
        hint: "It was built for gladiatorial contests and public spectacles.",
        explanation: "The Roman Colosseum, originally named the Flavian Amphitheatre, is the largest ancient amphitheatre ever built."
      },
      {
        question: "Which Roman general and statesman famously crossed the Rubicon River in 49 BC, sparking a civil war?",
        options: ["Mark Antony", "Julius Caesar", "Scipio Africanus", "Pompey the Great"],
        correctAnswer: 1,
        hint: "He is famous for the phrase 'Veni, vidi, vici' (I came, I saw, I conquered).",
        explanation: "Julius Caesar famously crossed the Rubicon in 49 BC in defiance of the Senate, triggering the civil war that ultimately led to his rise as dictator."
      },
      {
        question: "What was the official administrative and liturgical language of the Roman Empire?",
        options: ["Greek", "Latin", "Italian", "Etruscan"],
        correctAnswer: 1,
        hint: "It is the root of modern Romance languages.",
        explanation: "Latin was the primary spoken and written language of administration and military command throughout the Roman Empire."
      }
    ]
  },
  "javascript functions": {
    topic: "JavaScript Functions",
    questions: [
      {
        question: "What is the term for a function that is passed as an argument into another function and executed inside it?",
        options: ["Callback Function", "Closure", "Higher-Order Function", "IIFE"],
        correctAnswer: 0,
        hint: "It is literally called back later.",
        explanation: "A callback function is a function passed into another function as an argument, which is then invoked inside the outer function to complete some kind of routine or action."
      },
      {
        question: "Which keyword is used to declare a block-scoped variable in modern JavaScript (ES6+)?",
        options: ["var", "let", "define", "global"],
        correctAnswer: 1,
        hint: "It is a three-letter word and is the counterpart of 'const'.",
        explanation: "'let' allows you to declare variables that are limited in scope to the block, statement, or expression on which it is used, unlike 'var'."
      },
      {
        question: "What is the name of the feature that allows an inner function to access variables from its enclosing outer function, even after the outer function has finished executing?",
        options: ["Hoisting", "Recursion", "Closure", "Scope Chain"],
        correctAnswer: 2,
        hint: "It 'closes over' the surrounding state.",
        explanation: "A closure is the combination of a function bundled together (enclosed) with references to its surrounding state (the lexical environment)."
      },
      {
        question: "Which syntax represents a valid arrow function in modern JavaScript?",
        options: ["function myFunc() => {}", "const myFunc = () => {}", "myFunc() = => {}", "const myFunc => {}"],
        correctAnswer: 1,
        hint: "It assigns a variable to an argument list followed by the arrow token '=>'.",
        explanation: "Arrow functions are written as `const myFunc = (args) => { body }`, providing a shorter syntax and non-binding of 'this'."
      },
      {
        question: "What is the return value of evaluating the expression `typeof function(){}` in JavaScript?",
        options: ["'object'", "'function'", "'undefined'", "'class'"],
        correctAnswer: 1,
        hint: "It is the primitive type used to represent executable code in JS.",
        explanation: "Even though functions are objects under the hood, the `typeof` operator returns `'function'` for functions."
      }
    ]
  },
  "culinary arts": {
    topic: "Culinary Arts",
    questions: [
      {
        question: "What is the French culinary term for cutting vegetables into long, thin matchstick-like strips?",
        options: ["Chiffonade", "Julienne", "Brunoise", "Mince"],
        correctAnswer: 1,
        hint: "Commonly used for carrots or celery in salads.",
        explanation: "Julienne is a culinary knife cut in which the food item is cut into long, thin strips, similar to matchsticks."
      },
      {
        question: "Which of the following is NOT one of the five French classical 'Mother Sauces' established by Auguste Escoffier?",
        options: ["Béchamel", "Hollandaise", "Bolognese", "Velouté"],
        correctAnswer: 2,
        hint: "It is a meat-based Italian pasta sauce.",
        explanation: "Bolognese is an Italian meat sauce. The five French Mother Sauces are Béchamel, Velouté, Espagnole, Tomato, and Hollandaise."
      },
      {
        question: "What is the name of the process that occurs when heating sugar slowly, causing it to turn brown and create complex, sweet flavors?",
        options: ["Maillard Reaction", "Caramelization", "Fermentation", "Coagulation"],
        correctAnswer: 1,
        hint: "It is named directly after caramel.",
        explanation: "Caramelization is the oxidation of sugar, a process used extensively in cooking for the resulting nutty flavor and brown color."
      },
      {
        question: "What leavening agent is chemical-based and contains both an acid and a base, activating purely through moisture and heat?",
        options: ["Baking Soda", "Baking Powder", "Active Dry Yeast", "Sourdough Starter"],
        correctAnswer: 1,
        hint: "Unlike baking soda, it does not require an external acidic ingredient to activate.",
        explanation: "Baking powder contains both baking soda (sodium bicarbonate) and an acidifying agent, meaning it only needs liquid and heat to react."
      },
      {
        question: "Which short-grain rice is traditionally used in Italian cooking to make the classic, creamy dish Risotto?",
        options: ["Basmati Rice", "Jasmine Rice", "Arborio Rice", "Brown Rice"],
        correctAnswer: 2,
        hint: "It has a high starch content that gives risotto its signature texture.",
        explanation: "Arborio rice is an Italian short-grain rice. It is high in amylopectin starch, which gives risotto its creamy texture."
      }
    ]
  },
  "general knowledge": {
    topic: "General Knowledge",
    questions: [
      {
        question: "Which planet in our solar system is famously known as the 'Red Planet'?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correctAnswer: 1,
        hint: "It is named after the Roman god of war.",
        explanation: "Mars is known as the Red Planet because iron minerals in its soil oxidize (rust), causing the soil and atmosphere to look red."
      },
      {
        question: "Which Italian Renaissance polymath painted the world-famous portrait known as the Mona Lisa?",
        options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"],
        correctAnswer: 2,
        hint: "He also drew the Vitruvian Man and painted The Last Supper.",
        explanation: "The Mona Lisa was painted by Leonardo da Vinci between 1503 and 1519."
      },
      {
        question: "What is the chemical symbol for the element Gold on the Periodic Table?",
        options: ["Ag", "Fe", "Au", "Pb"],
        correctAnswer: 2,
        hint: "It comes from the Latin word 'Aurum', meaning shining dawn.",
        explanation: "The chemical symbol for gold is Au, derived from the Latin word 'aurum'."
      },
      {
        question: "Which ocean is the largest and deepest on Earth?",
        options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"],
        correctAnswer: 2,
        hint: "It covers more area than all of Earth's land area combined.",
        explanation: "The Pacific Ocean is the largest and deepest of Earth's oceanic divisions, extending from the Arctic Ocean in the north to the Southern Ocean in the south."
      },
      {
        question: "What is the capital city of Japan, known as the most populous metropolitan area in the world?",
        options: ["Kyoto", "Osaka", "Seoul", "Tokyo"],
        correctAnswer: 3,
        hint: "It was historically known as Edo.",
        explanation: "Tokyo is the capital of Japan and its most populous metropolis, known for its combination of ultra-modern skyscrapers and historic temples."
      }
    ]
  }
};

// --- Load Offline Quiz Function ---
function loadOfflineQuiz() {
  const normalizedTopic = (state.topic || "").trim().toLowerCase();
  let quizSource = OFFLINE_QUIZZES[normalizedTopic];
  
  if (!quizSource) {
    // Dynamically synthesize a topic-relevant quiz locally on the fly!
    quizSource = generateMockQuiz(state.topic || "General Knowledge");
    showToast(`API Offline. Synthesized quiz for "${state.topic}" locally!`, 'warning');
  } else {
    showToast(`Loaded Built-in Demo Quiz: ${quizSource.topic}`, 'success');
  }
  
  // Cleanly clone questions
  state.questions = JSON.parse(JSON.stringify(quizSource.questions));
  
  // Close the error modal if open
  elements.errorModal.classList.remove('active');
  
  // Transition directly to quiz view
  if (elements.loadingScreen.classList.contains('active')) {
    switchScreen(elements.loadingScreen, elements.quizScreen);
  } else if (elements.setupScreen.classList.contains('active')) {
    switchScreen(elements.setupScreen, elements.quizScreen);
  }
  
  startQuiz();
}

// --- Dynamic Quiz Synthesizer (Fallback Mode) ---
function generateMockQuiz(topic) {
  const titleTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
  
  return {
    topic: titleTopic,
    questions: [
      {
        question: `Which of the following is most closely related to the core concepts of ${titleTopic}?`,
        options: [
          `A fundamental component or defining property of ${titleTopic}`,
          `An unrelated historical event`,
          `A standard programming syntax for database connections`,
          `A basic culinary preparation technique`
        ],
        correctAnswer: 0,
        hint: `Focus on the primary definition and core values of ${titleTopic}.`,
        explanation: `The correct option represents a central pillar or core element that defines the subject of ${titleTopic}.`
      },
      {
        question: `What is a primary benefit or real-world application of ${titleTopic}?`,
        options: [
          `To solve specific challenges and optimize performance in its domain`,
          `To render complex 3D graphic models inside web browsers`,
          `To store passwords securely using local plaintext files`,
          `To automatically format text files into PDF documents`
        ],
        correctAnswer: 0,
        hint: `Think about why professionals study or implement ${titleTopic} in practice.`,
        explanation: `Studying or using ${titleTopic} is standard because it resolves critical issues and improves efficiency.`
      },
      {
        question: `Which statement best describes the development or origin of modern ${titleTopic}?`,
        options: [
          `It emerged as a progressive solution to overcome legacy limitations`,
          `It was discovered by accident during a chemistry experiment`,
          `It has remained completely unchanged since ancient civilizations`,
          `It was created as a secret government project in the late 1990s`
        ],
        correctAnswer: 0,
        hint: `Most subjects are developed to address constraints and expand capabilities.`,
        explanation: `${titleTopic} evolved dynamically as researchers and developers sought to build upon and improve older methods.`
      },
      {
        question: `What is a common misconception about the study of ${titleTopic}?`,
        options: [
          `That it is trivial and lacks depth or complex structures`,
          `That it was originally formulated by Isaac Newton in the 17th century`,
          `That it can only be legally practiced in select regions`,
          `That it has no correlation with modern science or technology`
        ],
        correctAnswer: 0,
        hint: `People often underestimate the complexity and scope of unfamiliar topics.`,
        explanation: `While it may appear straightforward at first, ${titleTopic} has substantial depth and requires methodical study to master.`
      },
      {
        question: `In professional or academic contexts, how is ${titleTopic} typically evaluated?`,
        options: [
          `By assessing its practical impact, effectiveness, and core metrics`,
          `By counting the number of letters in its formal designation`,
          `By checking its alignment with seasonal temperature variations`,
          `By measuring its acoustic footprint in sound chambers`
        ],
        correctAnswer: 0,
        hint: `Evaluation in any field focuses on real-world outcomes and metrics.`,
        explanation: `Professionals measure the success of ${titleTopic} by analyzing its practical results, efficiency, and overall performance.`
      }
    ]
  };
}
