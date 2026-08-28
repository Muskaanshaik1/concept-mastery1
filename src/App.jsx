import { useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function createStarterLesson(topic, level) {
  return {
    title: `${topic}: a ${level.toLowerCase()} introduction`,
    explanation: `${topic} is a concept you can understand by identifying its purpose, its main parts, and how those parts work together. Start with a simple example, then compare it with a more advanced case.`,
    example: `Think of a real-world situation involving ${topic}. Describe what goes in, what happens, and what result comes out.`,
    keyPoints: [
      `Define ${topic} in your own words.`,
      "Break the concept into smaller parts.",
      "Test your understanding with a practical example.",
    ],
    questions: [
      {
        question: `What is the best first step when learning ${topic}?`,
        options: ["Memorize every detail", "Understand its purpose", "Skip examples", "Guess the answer"],
        correctAnswer: "Understand its purpose",
        reason: "Knowing the purpose gives the details a meaningful context.",
      },
      {
        question: `How should you approach a difficult part of ${topic}?`,
        options: ["Break it into smaller parts", "Ignore it", "Copy it without reading", "Start with the hardest detail"],
        correctAnswer: "Break it into smaller parts",
        reason: "Smaller parts are easier to understand and connect.",
      },
      {
        question: `Which activity best checks your understanding of ${topic}?`,
        options: ["Explaining it in your own words", "Reading the title only", "Avoiding practice", "Memorizing unrelated facts"],
        correctAnswer: "Explaining it in your own words",
        reason: "An explanation shows whether you can apply the idea, not just recognize it.",
      },
      {
        question: "What should a useful example contain?",
        options: ["A practical situation", "Only definitions", "Unrelated information", "No result"],
        correctAnswer: "A practical situation",
        reason: "Practical situations connect an abstract concept to something observable.",
      },
      {
        question: "What should you do after finding a mistake?",
        options: ["Review the reason and try again", "Delete your notes", "Stop learning", "Ignore the feedback"],
        correctAnswer: "Review the reason and try again",
        reason: "Feedback turns a mistake into a targeted learning opportunity.",
      },
    ],
  };
}

function App() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [videoUrl, setVideoUrl] = useState("");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lessonData, setLessonData] = useState(null);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [error, setError] = useState("");
  const topicInputRef = useRef(null);

  const startLearning = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic to learn.");
      topicInputRef.current?.focus();
      return;
    }
    setStarted(true);
    setLoading(true);
    setLessonData(null);
    setError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${API_URL}/api/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate lesson.");
      }
      setLessonData(data);
    } catch (err) {
      console.error(err);
      setLessonData(createStarterLesson(topic.trim(), level));
      setError("AI is temporarily unavailable, so a starter lesson is shown. You can continue learning.");
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = () => {
    setAssessmentStarted(true);
    setCurrentQuestion(0);
    setSelectedAnswer("");
    setAnswers([]);
    setShowReview(false);
    setDiagnosis(null);
  };

  const submitAnswer = async () => {
    if (!selectedAnswer) {
      alert("Please select an answer.");
      return;
    }
    const questions = lessonData.questions;
    const updatedAnswers = [...answers];
    updatedAnswers[currentQuestion] = selectedAnswer;
    setAnswers(updatedAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer("");
    } else {
      setShowReview(true);
      setDiagnosing(true);
      try {
        const results = questions.map((q, i) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          studentAnswer: updatedAnswers[i] || "Not answered",
        }));
        const res = await fetch(`${API_URL}/api/diagnose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, level, results }),
        });
        const data = await res.json();
        setDiagnosis(data);
      } catch (err) {
        console.error(err);
      } finally {
        setDiagnosing(false);
      }
    }
  };

  const restartAssessment = () => {
    setAssessmentStarted(false);
    setCurrentQuestion(0);
    setSelectedAnswer("");
    setAnswers([]);
    setShowReview(false);
    setDiagnosis(null);
  };

  const questions = lessonData?.questions || [];
  const score = answers.filter((a, i) => a === questions[i]?.correctAnswer).length;
  const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const embedUrl = getYouTubeEmbedUrl(videoUrl);

  return (
    <div className="app">
      <nav className="navbar">
        <div className="logo">
          <span className="logo-icon">✦</span>
          <span>
            Concept<span>Mastery</span>
          </span>
        </div>
        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#how-it-works">How it works</a>
          <button
            className="nav-button"
            onClick={() => {
              setStarted(false);
              setError("");
              setTimeout(() => topicInputRef.current?.focus(), 0);
            }}
          >
            Start Learning
          </button>
        </div>
      </nav>

      {started ? (
        <main className="learning-page">
          <div className="learning-header">
            <p className="small-label">YOUR AI LEARNING SESSION</p>
            <h1>
              Let's master <span>{topic}</span>
            </h1>
            <p>
              Learning level: <strong>{level}</strong>
            </p>
          </div>

          {loading ? (
            <div className="ai-card">
              <div className="ai-card-header">
                <div className="ai-icon">✦</div>
                <div>
                  <p className="agent-name">AI Learning Agent</p>
                  <p className="agent-status">Generating your personalized lesson...</p>
                </div>
              </div>
              <div className="explanation">
                <p>This usually takes a few seconds. Please wait.</p>
              </div>
            </div>
          ) : !lessonData ? (
            <div className="ai-card">
              <div className="explanation">
                <p>Something went wrong loading the lesson. Please go back and try again.</p>
              </div>
              <button className="start-button" onClick={() => setStarted(false)}>
                ← Back
              </button>
            </div>
          ) : !assessmentStarted ? (
            <div className="ai-card">
              <div className="ai-card-header">
                <div className="ai-icon">✦</div>
                <div>
                  <p className="agent-name">AI Learning Agent</p>
                  <p className="agent-status">Ready to teach you</p>
                </div>
              </div>

              <div className="explanation">
                {embedUrl && (
                  <div style={{ marginBottom: "20px" }}>
                    <iframe
                      width="100%"
                      height="315"
                      src={embedUrl}
                      title="Learning video"
                      style={{ borderRadius: "12px", border: "none" }}
                      allowFullScreen
                    />
                  </div>
                )}

                <h2>{lessonData.title}</h2>
                <p>{lessonData.explanation}</p>

                <div className="concept-box">
                  <strong>Example</strong>
                  <p>{lessonData.example}</p>
                </div>

                <div className="concept-box">
                  <strong>Key Points</strong>
                  <ul>
                    {lessonData.keyPoints?.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button className="start-button" onClick={startAssessment}>
                Start Assessment
                <span>→</span>
              </button>
            </div>
          ) : showReview ? (
            <div className="ai-card">
              <div className="explanation">
                <h2>Assessment Review</h2>

                <div className="concept-box">
                  <strong>
                    Your Score: {score} / {questions.length}
                  </strong>
                  <p>Mastery Level: {percentage}%</p>
                  <p>
                    {percentage >= 80
                      ? "Excellent! You have a strong understanding of this concept."
                      : percentage >= 60
                      ? "Good work! A little more practice will strengthen your understanding."
                      : "Keep practicing. Review the explanations below and try again."}
                  </p>
                </div>

                {diagnosing ? (
                  <div className="concept-box" style={{ marginTop: "20px" }}>
                    <p>Analyzing your understanding to find misconceptions...</p>
                  </div>
                ) : diagnosis ? (
                  <div className="concept-box" style={{ marginTop: "20px" }}>
                    <strong>AI Diagnosis: {diagnosis.masteryLevel}</strong>
                    <p>{diagnosis.overallMastery}</p>
                    {diagnosis.misconceptions?.length > 0 && (
                      <>
                        <strong>Misconceptions Found</strong>
                        {diagnosis.misconceptions.map((m, i) => (
                          <div
                            key={i}
                            style={{
                              marginTop: "10px",
                              padding: "10px",
                              background: "#fff",
                              borderRadius: "8px",
                            }}
                          >
                            <p><strong>{m.question}</strong></p>
                            <p>You likely thought: {m.likelyMisconception}</p>
                            <p>Correction: {m.correction}</p>
                          </div>
                        ))}
                      </>
                    )}
                    <p style={{ marginTop: "10px" }}>
                      <strong>Next step:</strong> {diagnosis.recommendedNextStep}
                    </p>
                  </div>
                ) : null}

                <div className="concept-box next-learning">
                  <strong>Continue Learning</strong>
                  <p>
                    Review the lesson, focus on the questions you missed, and
                    practice the concept again before retaking the assessment.
                  </p>
                  {diagnosis?.recommendedNextStep && (
                    <p><strong>Personalized next step:</strong> {diagnosis.recommendedNextStep}</p>
                  )}
                  <button
                    className="start-button"
                    onClick={() => {
                      setAssessmentStarted(false);
                      setShowReview(false);
                      setSelectedAnswer("");
                    }}
                  >
                    Review Lesson
                    <span>→</span>
                  </button>
                </div>

                {questions.map((question, index) => {
                  const userAnswer = answers[index];
                  const isCorrect = userAnswer === question.correctAnswer;
                  return (
                    <div
                      key={index}
                      style={{
                        marginTop: "25px",
                        padding: "18px",
                        border: "1px solid #ddd",
                        borderRadius: "10px",
                      }}
                    >
                      <h3>
                        {index + 1}. {question.question}
                      </h3>
                      <p>
                        <strong>Your answer:</strong> {userAnswer || "Not answered"}
                      </p>
                      <p>
                        <strong>Correct answer:</strong> {question.correctAnswer}
                      </p>
                      <p>
                        <strong>{isCorrect ? "Correct" : "Needs Review"}</strong>
                      </p>
                      <p>{question.reason}</p>
                    </div>
                  );
                })}
              </div>

              <button className="start-button" onClick={restartAssessment}>
                Try Assessment Again
                <span>↻</span>
              </button>
            </div>
          ) : (
            <div className="ai-card">
              <div className="ai-card-header">
                <div className="ai-icon">✦</div>
                <div>
                  <p className="agent-name">AI Learning Agent</p>
                  <p className="agent-status">
                    Question {currentQuestion + 1} of {questions.length}
                  </p>
                </div>
              </div>

              <div className="explanation">
                <h2>Question {currentQuestion + 1}</h2>
                <h3>{questions[currentQuestion].question}</h3>

                <div>
                  {questions[currentQuestion].options.map((option, index) => (
                    <label
                      key={index}
                      style={{
                        display: "block",
                        margin: "12px 0",
                        padding: "12px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="answer"
                        value={option}
                        checked={selectedAnswer === option}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        style={{ marginRight: "10px" }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <button className="start-button" onClick={submitAnswer}>
                {currentQuestion === questions.length - 1 ? "Submit & Review" : "Submit Answer"}
                <span>→</span>
              </button>
            </div>
          )}
        </main>
      ) : (
        <main id="home">
          <section className="hero-section">
            <div className="hero-content">
              <div className="badge">
                <span>✦</span>
                AI-POWERED PERSONALIZED LEARNING
              </div>

              <h1>
                Don't just learn.
                <br />
                <span>Understand.</span>
              </h1>

              <p className="hero-description">
                An AI learning companion that identifies your misconceptions, adapts
                explanations to your understanding, and helps you master concepts through
                intelligent practice.
              </p>

              <div className="learning-card">
                <label>Paste a YouTube video link (optional)</label>
                <input
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />

                <label>What do you want to learn?</label>
                <input
                  ref={topicInputRef}
                  type="text"
                  placeholder="e.g. JavaScript Arrays, Photosynthesis..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />

                <label>Your current level</label>
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>

                <button className="start-button" onClick={startLearning}>
                  Start My Learning Journey
                  <span>→</span>
                </button>
                {error && <p className="error-message" role="alert">{error}</p>}
              </div>
            </div>

            <div className="hero-visual">
              <div className="brain-circle">
                <div className="brain-symbol">✦</div>
              </div>
              <div className="floating-card card-one">
                <span>AI Tutor</span>
                <strong>Personalized explanation</strong>
              </div>
              <div className="floating-card card-two">
                <span>Concept Mastery</span>
                <strong>82%</strong>
              </div>
              <div className="floating-card card-three">
                <span>Misconception detected</span>
                <strong>Array mutation</strong>
              </div>
            </div>
          </section>

          <section id="how-it-works" className="how-section">
            <div className="section-heading">
              <p>HOW IT WORKS</p>
              <h2>Learning that adapts to you.</h2>
            </div>

            <div className="steps">
              <div className="step">
                <div className="step-number">01</div>
                <h3>Learn</h3>
                <p>Get explanations tailored to your knowledge level and learning preference.</p>
              </div>
              <div className="step">
                <div className="step-number">02</div>
                <h3>Practice</h3>
                <p>Answer AI-generated questions designed to test your actual understanding.</p>
              </div>
              <div className="step">
                <div className="step-number">03</div>
                <h3>Understand</h3>
                <p>Our AI identifies misconceptions and adapts what you learn next.</p>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default App;