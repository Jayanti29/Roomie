export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(arr: T[]): T[] {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Shuffles options and updates the answerIndex dynamically
function shuffleQuestionOptions(q: QuizQuestion): QuizQuestion {
  const correctAnswerText = q.options[q.answerIndex];
  const shuffledOptions = shuffleArray(q.options);
  const newAnswerIndex = shuffledOptions.indexOf(correctAnswerText);
  return {
    ...q,
    options: shuffledOptions,
    answerIndex: newAnswerIndex
  };
}

export const generateQuestionsForTopic = (topic: string): QuizQuestion[] => {
  const cleanTopic = topic.trim().toLowerCase();
  
  let selectedPool: QuizQuestion[] = [];

  // 1. Computer Science Pool
  if (
    cleanTopic.includes('react') || 
    cleanTopic.includes('hook') || 
    cleanTopic.includes('code') || 
    cleanTopic.includes('javascript') || 
    cleanTopic.includes('js') || 
    cleanTopic.includes('programming') || 
    cleanTopic.includes('computer') || 
    cleanTopic.includes('data structure') || 
    cleanTopic.includes('algorithm') ||
    cleanTopic.includes('html') ||
    cleanTopic.includes('css')
  ) {
    selectedPool = [
      {
        question: `In web development using ${topic}, which of the following is true about state management?`,
        options: [
          'State updates are processed synchronously and immediately block rendering.',
          'State should only be modified directly without using set functions.',
          'State updates are batched and scheduled asynchronously for performance.',
          'State variables are stored permanently inside the browser cookies.'
        ],
        answerIndex: 2,
        explanation: 'State updates in UI frameworks are queued and processed asynchronously in batches to optimize UI re-renders.'
      },
      {
        question: `When building applications around ${topic}, what is the main purpose of virtual DOM diffing?`,
        options: [
          'To scan files for syntactic syntax rules.',
          'To compute minimal layout operations before modifying the real DOM.',
          'To compile JavaScript files into machine-level code.',
          'To encrypt client data before transmitting it over websockets.'
        ],
        answerIndex: 1,
        explanation: 'Virtual DOM comparison calculates the minimum differences and updates only what changed, avoiding expensive layout paints.'
      },
      {
        question: `What is considered a best practice when managing side effects in ${topic}?`,
        options: [
          'Perform operations inside the constructor to block page load.',
          'Use dedicated cleanup functions to unsubscribe listeners and clean timers.',
          'Avoid side effects entirely and write static HTML pages.',
          'Force clean page reloads whenever data changes.'
        ],
        answerIndex: 1,
        explanation: 'Using cleanup functions prevents memory leaks by releasing subscriptions, sockets, and timers when components unmount.'
      },
      {
        question: 'What does the REST architectural style stand for in web services?',
        options: [
          'Representational State Transfer',
          'Responsive System Text',
          'Realtime Encrypted Secure Transmission',
          'Resource Emulation Service Template'
        ],
        answerIndex: 0,
        explanation: 'REST stands for Representational State Transfer, representing stateless communications between clients and servers.'
      },
      {
        question: 'Which of the following data structures operates on a Last-In, First-Out (LIFO) model?',
        options: [
          'Queue',
          'Linked List',
          'Stack',
          'Hash Map'
        ],
        answerIndex: 2,
        explanation: 'A Stack operates on a LIFO model, where the last element inserted is the first one removed.'
      },
      {
        question: 'What is the primary purpose of an index in a relational database?',
        options: [
          'To encrypt sensitive columns.',
          'To speed up data retrieval queries.',
          'To automatically write backup tables.',
          'To prevent duplicate values across all rows.'
        ],
        answerIndex: 1,
        explanation: 'Indexes create high-speed lookup paths, dramatically reducing database scan times during SELECT queries.'
      },
      {
        question: 'What is the average time complexity of searching for an element in a balanced binary search tree?',
        options: [
          'O(n)',
          'O(1)',
          'O(log n)',
          'O(n log n)'
        ],
        answerIndex: 2,
        explanation: 'A balanced BST halves the search space at each node, giving it an average time complexity of O(log n).'
      },
      {
        question: 'In JavaScript, what is the main difference between == and ===?',
        options: [
          '== does not support strings.',
          '=== compares values and types, whereas == performs automatic type coercion.',
          '== is faster on modern mobile browsers.',
          '=== is obsolete in Manifest V3 specifications.'
        ],
        answerIndex: 1,
        explanation: '=== is the strict equality operator, checking value and type. == coerces types before checking.'
      }
    ];
  }
  // 2. Mathematics Pool
  else if (
    cleanTopic.includes('calculus') || 
    cleanTopic.includes('math') || 
    cleanTopic.includes('linear') || 
    cleanTopic.includes('algebra') || 
    cleanTopic.includes('matrix') || 
    cleanTopic.includes('equation') || 
    cleanTopic.includes('derivative') ||
    cleanTopic.includes('integral') ||
    cleanTopic.includes('geometry')
  ) {
    selectedPool = [
      {
        question: `When computing properties of ${topic}, what does it mean if a system has a determinant of zero?`,
        options: [
          'The system has a unique, stable singular solution.',
          'The matrix is invertible and can be scaled easily.',
          'The system of linear equations has either no solution or infinitely many solutions.',
          'The eigenvalues are all real positive numbers.'
        ],
        answerIndex: 2,
        explanation: 'A zero determinant means the matrix is singular (non-invertible), meaning equations are linearly dependent.'
      },
      {
        question: `Which of the following is the derivative of the product function f(x)g(x) in ${topic}?`,
        options: [
          "f'(x)g'(x) product rule.",
          "f'(x)g(x) + f(x)g'(x) sum-product formula.",
          "f'(x) - g'(x) differential difference.",
          "(f(x) + g(x))' linear scaling."
        ],
        answerIndex: 1,
        explanation: "By the Product Rule, the derivative of f(x)g(x) is f'(x)g(x) + f(x)g'(x)."
      },
      {
        question: `What is a core application of eigenvalues and eigenvectors in ${topic}?`,
        options: [
          'To solve non-linear equations directly.',
          'To perform coordinate system rotations and principal component scaling.',
          'To calculate standard integrals of continuous curves.',
          'To index data rows in a standard SQL database.'
        ],
        answerIndex: 1,
        explanation: 'Eigenvalues represent the scaling factors of eigenvectors during linear coordinate transformations.'
      },
      {
        question: 'What is the limit of sin(x) / x as x approaches 0?',
        options: [
          '0',
          'Infinity',
          '1',
          'Undefined'
        ],
        answerIndex: 2,
        explanation: 'Using L\'Hopital\'s rule or Taylor expansions, the limit of sin(x)/x as x -> 0 is 1.'
      },
      {
        question: 'What is the derivative of the natural logarithm ln(x) with respect to x?',
        options: [
          'e^x',
          '1/x',
          'x * ln(x) - x',
          '1 / (x * ln(e))'
        ],
        answerIndex: 1,
        explanation: 'The derivative of ln(x) for x > 0 is 1/x.'
      },
      {
        question: 'If two vectors are orthogonal, what is their dot product?',
        options: [
          '1',
          '0',
          '-1',
          'The product of their magnitudes'
        ],
        answerIndex: 1,
        explanation: 'Vectors are orthogonal if their angle is 90 degrees. Since cos(90) = 0, their dot product is 0.'
      },
      {
        question: 'What is the sum of the interior angles of a triangle in Euclidean geometry?',
        options: [
          '90 degrees',
          '180 degrees',
          '360 degrees',
          '270 degrees'
        ],
        answerIndex: 1,
        explanation: 'The interior angles of any planar Euclidean triangle sum to 180 degrees (pi radians).'
      },
      {
        question: 'In classical probability theory, what is the probability of an impossible event?',
        options: [
          '0',
          '0.5',
          '1',
          'Negative values'
        ],
        answerIndex: 0,
        explanation: 'An impossible event has no outcomes in the sample space, so its probability is exactly 0.'
      }
    ];
  }
  // 3. Physics / Science Pool
  else if (
    cleanTopic.includes('physic') || 
    cleanTopic.includes('mechanic') || 
    cleanTopic.includes('quantum') || 
    cleanTopic.includes('electromagnet') || 
    cleanTopic.includes('gravity') || 
    cleanTopic.includes('force') ||
    cleanTopic.includes('relativity') ||
    cleanTopic.includes('chem') ||
    cleanTopic.includes('bio')
  ) {
    selectedPool = [
      {
        question: `In the study of ${topic}, which law states that an object remains at rest unless acted upon by an external force?`,
        options: [
          'Faradays law of induction.',
          'Newtons first law of motion (Inertia).',
          'Heisenbergs uncertainty principle.',
          'Keplers third law of planetary orbits.'
        ],
        answerIndex: 1,
        explanation: 'Newtons first law states that velocity remains constant unless a net external force acts on the object.'
      },
      {
        question: `How does Heisenbergs Uncertainty Principle apply to quantum mechanics in ${topic}?`,
        options: [
          'It is impossible to measure both the position and momentum of a particle with absolute precision simultaneously.',
          'Energy cannot be created or destroyed, only transferred.',
          'The speed of light is variable in vacuum spaces.',
          'Magnetic monopoles exist at low temperatures.'
        ],
        answerIndex: 0,
        explanation: 'The product of uncertainties of position and momentum is bounded by a constant (hbar/2), making precise simultaneous measurement impossible.'
      },
      {
        question: `Which of the following correctly describes Faradays Law of Induction in ${topic}?`,
        options: [
          'Electrostatic force is proportional to charge values.',
          'A changing magnetic field induces an electromotive force (EMF).',
          'Current is equal to voltage divided by resistance.',
          'Light travels in wavepackets called photons.'
        ],
        answerIndex: 1,
        explanation: 'Faradays Law states that the induced voltage in a circuit is proportional to the time rate of change of magnetic flux.'
      },
      {
        question: 'What is the speed of light in a vacuum?',
        options: [
          '300,000 m/s',
          '3 x 10^8 m/s',
          '150,000 km/s',
          '3 x 10^6 m/s'
        ],
        answerIndex: 1,
        explanation: 'The speed of light in a vacuum is defined as exactly 299,792,458 m/s, which is approximately 3 x 10^8 m/s.'
      },
      {
        question: 'Which law of thermodynamics states that the entropy of an isolated system always increases over time?',
        options: [
          'First Law',
          'Second Law',
          'Third Law',
          'Zeroth Law'
        ],
        answerIndex: 1,
        explanation: 'The Second Law states that natural processes increase the overall disorder (entropy) of an isolated system.'
      },
      {
        question: 'What force keeps planets in stable orbits around stars?',
        options: [
          'Electromagnetic Force',
          'Strong Nuclear Force',
          'Gravitational Force',
          'Centrifugal Cohesion'
        ],
        answerIndex: 2,
        explanation: 'Gravity is the mutual attraction that pulls bodies together, keeping celestial orbits bound.'
      },
      {
        question: 'What is the primary charge carrier in n-type semiconductor materials?',
        options: [
          'Holes',
          'Positrons',
          'Electrons',
          'Protons'
        ],
        answerIndex: 2,
        explanation: 'n-type semiconductors are doped with pentavalent impurities, leading to an excess of conduction electrons.'
      },
      {
        question: 'What is the SI unit of electrical resistance?',
        options: [
          'Volt',
          'Ampere',
          'Ohm',
          'Watt'
        ],
        answerIndex: 2,
        explanation: 'Resistance is measured in Ohms (symbol: Ω), representing the ratio of voltage to current.'
      }
    ];
  }
  // 4. Default / Dynamic Topic Generator Pool
  else {
    const keywords = topic.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    selectedPool = [
      {
        question: `What is considered the primary objective when studying the fundamentals of "${keywords}"?`,
        options: [
          `To isolate key variables of ${keywords} and analyze their interactions.`,
          `To replace all instances of ${keywords} with generic layout configurations.`,
          `To solve the equation for ${keywords} by dividing by zero.`,
          `To store ${keywords} properties inside the web localstorage database.`
        ],
        answerIndex: 0,
        explanation: `Studying the core mechanics of ${keywords} helps isolate and model dynamic variables to predict experimental results.`
      },
      {
        question: `When dealing with "${keywords}" in academic work, which problem occurs most frequently?`,
        options: [
          'Running out of memory allocation pointers.',
          `Difficulty modeling variables due to high noise or external factor limits on ${keywords}.`,
          `Failing to compile stylesheet tags in older rendering clients.`,
          `Automatic server timeouts during API response delays.`
        ],
        answerIndex: 1,
        explanation: `Modeling ${keywords} requires controlling experimental boundaries, as environmental factors introduce variables and noise.`
      },
      {
        question: `Which methodology is standard to prove hypotheses relating to "${keywords}"?`,
        options: [
          'Declaring initial functions inside static local variables.',
          `Controlled experimentation, metric recording, and comparative mathematical review of ${keywords} results.`,
          `Performing simple text queries inside relational databases.`,
          `Executing quick script tests without recording control groups.`
        ],
        answerIndex: 1,
        explanation: `Scientific proof relies on comparing experimental results against clean control baselines to determine significance.`
      },
      {
        question: `What is the first step in conducting structured research on "${keywords}"?`,
        options: [
          `Conducting a literature review to see existing scholarly publications on ${keywords}.`,
          'Building production build bundles using automation tools.',
          'Importing styling properties in local layout tags.',
          'Deploying database migration configurations.'
        ],
        answerIndex: 0,
        explanation: `A literature review helps understand prior discoveries, methods, and gaps regarding ${keywords} before experimenting.`
      },
      {
        question: `Why is peer review critical in academic publications about "${keywords}"?`,
        options: [
          'It translates reports into multiple human languages.',
          `It exposes the paper to review by independent subject experts to validate research methodologies on ${keywords}.`,
          'It is required to host code files on shared repositories.',
          'It increases the database read/write speeds.'
        ],
        answerIndex: 1,
        explanation: 'Peer review acts as a quality filter, verifying that the research methods, analysis, and conclusions are solid and credible.'
      },
      {
        question: `Which type of reasoning starts with a general theory about "${keywords}" and tests it?`,
        options: [
          'Inductive reasoning',
          'Deductive reasoning',
          'Circular arguments',
          'Ad-hoc explanations'
        ],
        answerIndex: 1,
        explanation: 'Deductive reasoning goes from general theories to specific observations to verify hypotheses.'
      }
    ];
  }

  // Shuffle the selected pool
  const shuffledPool = shuffleArray(selectedPool);

  // Take the first 3 questions and shuffle their options
  const finalQuestions = shuffledPool.slice(0, 3).map(q => shuffleQuestionOptions(q));

  return finalQuestions;
};
