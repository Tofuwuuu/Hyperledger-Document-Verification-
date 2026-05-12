import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { authService } from '../services/api';
import AuthShell from './auth/AuthShell';

const getErrorMessage = (err, fallback) => {
  if (err.status === 404 || err.response?.status === 404) {
    return 'No account found with this email address.';
  }

  if (err.status === 400 || err.response?.status === 400) {
    return 'Security questions are not configured for this account. Use password reset instead.';
  }

  return err.response?.data?.detail || err.message || fallback;
};

export default function AccountRecoveryPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.getSecurityQuestions(email.trim());

      if (response.questions?.length >= 2) {
        setQuestions(response.questions);
        setAnswers(new Array(response.questions.length).fill(''));
        setStep('questions');
      } else {
        setError('No security questions were found for this account. Use password reset instead.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load security questions. Please try again later.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (index, value) => {
    const nextAnswers = [...answers];
    nextAnswers[index] = value;
    setAnswers(nextAnswers);
  };

  const handleQuestionsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const answeredCount = answers.filter((answer) => answer.trim().length > 0).length;
    if (answeredCount < 2) {
      setError('Please answer at least 2 security questions.');
      return;
    }

    setLoading(true);

    try {
      const answersData = questions
        .map((question, index) => ({
          question_idx: question.index,
          answer: answers[index],
        }))
        .filter((answer) => answer.answer.trim().length > 0);

      const response = await authService.verifySecurityQuestions({
        email: email.trim(),
        answers: answersData,
      });

      if (response.status === 'success' && response.reset_token) {
        navigate(`/reset-password?token=${encodeURIComponent(response.reset_token)}`);
      } else {
        setStep('success');
      }
    } catch (err) {
      if (err.status === 401 || err.response?.status === 401) {
        setError('The answers provided do not match our records. Please try again.');
      } else {
        setError(getErrorMessage(err, 'Could not verify your answers. Please try again later.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recover your account"
      subtitle="Answer your security questions to verify your identity."
      switchText="Want the standard reset flow?"
      switchTo="/reset-password"
      switchLabel="Use password reset"
      badgeText="Security question recovery"
    >
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-800">{error}</p>
              {error.includes('password reset') && (
                <Link to="/reset-password" className="mt-2 inline-flex text-sm font-semibold text-red-700 underline">
                  Continue with password reset
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 'email' && (
        <form className="space-y-5" onSubmit={handleEmailSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="form-input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
            />
            <p className="mt-2 text-xs text-slate-500">
              We will only show the questions saved on your account.
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary flex w-full justify-center disabled:cursor-not-allowed disabled:opacity-70"
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Continue'}
            {!loading && <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />}
          </button>

          <Link
            to="/login"
            className="flex w-full items-center justify-center text-sm font-semibold text-slate-600 hover:text-cvsu-green"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to login
          </Link>
        </form>
      )}

      {step === 'questions' && (
        <form className="space-y-5" onSubmit={handleQuestionsSubmit}>
          <div className="rounded-lg border border-cvsu-green/20 bg-cvsu-green/10 p-4">
            <div className="flex gap-3">
              <QuestionMarkCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-cvsu-green" aria-hidden="true" />
              <p className="text-sm font-medium text-cvsu-green">
                Answer at least 2 questions for {email}.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.index}>
                <label htmlFor={`question-${index}`} className="block text-sm font-semibold text-slate-700">
                  {question.question}
                </label>
                <input
                  id={`question-${index}`}
                  type="text"
                  className="form-input mt-1"
                  value={answers[index]}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  placeholder="Enter your answer"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="flex items-center justify-center text-sm font-semibold text-slate-600 hover:text-cvsu-green"
              onClick={() => setStep('email')}
              disabled={loading}
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <button
              type="submit"
              className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify answers'}
            </button>
          </div>
        </form>
      )}

      {step === 'success' && (
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Your identity was verified. Continue to reset your password.
          </p>
          <button type="button" className="btn-primary mt-6 w-full" onClick={() => navigate('/reset-password')}>
            Continue
          </button>
        </div>
      )}
    </AuthShell>
  );
}
