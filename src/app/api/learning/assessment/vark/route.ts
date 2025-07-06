// API routes for VARK assessment
import { NextRequest, NextResponse } from 'next/server';
import { LearningService } from '@/services/learning-service';

const learningService = new LearningService();

// VARK Questionnaire Data
const VARK_QUESTIONS = [
  {
    id: 'q1',
    question: 'You are helping someone who wants to go to your airport, town centre, or railway station. You would:',
    options: [
      { id: 'a', text: 'go with her', style: 'kinesthetic' },
      { id: 'b', text: 'draw, or give her a map', style: 'visual' },
      { id: 'c', text: 'tell her the directions', style: 'auditory' },
      { id: 'd', text: 'write down the directions', style: 'reading' }
    ]
  },
  {
    id: 'q2',
    question: 'You are not sure whether a word should be spelled "dependent" or "dependant". You would:',
    options: [
      { id: 'a', text: 'see the words in your mind and choose by the way they look', style: 'visual' },
      { id: 'b', text: 'think about how each word sounds and choose one', style: 'auditory' },
      { id: 'c', text: 'find it in a dictionary', style: 'reading' },
      { id: 'd', text: 'write both words on paper and choose one', style: 'kinesthetic' }
    ]
  },
  {
    id: 'q3',
    question: 'You are planning a holiday for a group. You want some feedback from them about the plan. You would:',
    options: [
      { id: 'a', text: 'describe some of the highlights', style: 'auditory' },
      { id: 'b', text: 'use a map or website to show them the places', style: 'visual' },
      { id: 'c', text: 'give them a copy of the printed itinerary', style: 'reading' },
      { id: 'd', text: 'phone, text or email them', style: 'kinesthetic' }
    ]
  },
  {
    id: 'q4',
    question: 'You are going to cook something as a special treat for your family. You would:',
    options: [
      { id: 'a', text: 'cook something you know without the need for instructions', style: 'kinesthetic' },
      { id: 'b', text: 'ask friends for suggestions', style: 'auditory' },
      { id: 'c', text: 'look through the cookbook for ideas from the pictures', style: 'visual' },
      { id: 'd', text: 'use a cookbook where you know there is a good recipe', style: 'reading' }
    ]
  },
  {
    id: 'q5',
    question: 'A group of tourists wants to learn about the parks or wildlife reserves in your area. You would:',
    options: [
      { id: 'a', text: 'talk about, or arrange a talk for them about parks or wildlife reserves', style: 'auditory' },
      { id: 'b', text: 'show them internet pictures, photographs, or picture books', style: 'visual' },
      { id: 'c', text: 'take them to a park or wildlife reserve and walk with them', style: 'kinesthetic' },
      { id: 'd', text: 'give them a book or pamphlets about the parks or wildlife reserves', style: 'reading' }
    ]
  },
  {
    id: 'q6',
    question: 'You are about to purchase a digital camera or mobile phone. Other than price, what would most influence your decision?',
    options: [
      { id: 'a', text: 'trying or testing it', style: 'kinesthetic' },
      { id: 'b', text: 'reading the details about its features', style: 'reading' },
      { id: 'c', text: 'it is a modern design and looks good', style: 'visual' },
      { id: 'd', text: 'the salesperson telling me about its features', style: 'auditory' }
    ]
  },
  {
    id: 'q7',
    question: 'Remember a time when you learned how to do something new. Try to avoid choosing a physical skill, e.g. riding a bike. You learned best by:',
    options: [
      { id: 'a', text: 'watching a demonstration', style: 'visual' },
      { id: 'b', text: 'listening to somebody explaining it and asking questions', style: 'auditory' },
      { id: 'c', text: 'diagrams and charts - visual clues', style: 'visual' },
      { id: 'd', text: 'written instructions - e.g. a manual or textbook', style: 'reading' }
    ]
  },
  {
    id: 'q8',
    question: 'You have a problem with your knee. You would prefer that the doctor:',
    options: [
      { id: 'a', text: 'gave you a web address or something to read about it', style: 'reading' },
      { id: 'b', text: 'used a plastic model of a knee to show what was wrong', style: 'kinesthetic' },
      { id: 'c', text: 'described what was wrong', style: 'auditory' },
      { id: 'd', text: 'showed you a diagram of what was wrong', style: 'visual' }
    ]
  },
  {
    id: 'q9',
    question: 'You want to learn a new program, skill or game on a computer. You would:',
    options: [
      { id: 'a', text: 'read the written instructions that came with the program', style: 'reading' },
      { id: 'b', text: 'talk with people who know about the program', style: 'auditory' },
      { id: 'c', text: 'use the controls or keyboard', style: 'kinesthetic' },
      { id: 'd', text: 'follow the diagrams in the book that came with it', style: 'visual' }
    ]
  },
  {
    id: 'q10',
    question: 'You like websites that have:',
    options: [
      { id: 'a', text: 'things you can click on, shift or try', style: 'kinesthetic' },
      { id: 'b', text: 'interesting design and visual features', style: 'visual' },
      { id: 'c', text: 'interesting written descriptions, lists and explanations', style: 'reading' },
      { id: 'd', text: 'audio channels where you can hear music, radio programs or interviews', style: 'auditory' }
    ]
  },
  {
    id: 'q11',
    question: 'Other than price, what would most influence your decision to buy a new non-fiction book?',
    options: [
      { id: 'a', text: 'the way it looks is appealing', style: 'visual' },
      { id: 'b', text: 'quickly reading parts of it', style: 'reading' },
      { id: 'c', text: 'a friend talks about it and recommends it', style: 'auditory' },
      { id: 'd', text: 'it has real-life stories, experiences and examples', style: 'kinesthetic' }
    ]
  },
  {
    id: 'q12',
    question: 'You are using a book, CD or website to learn how to take photos with your new digital camera. You would like to have:',
    options: [
      { id: 'a', text: 'a chance to ask questions and talk about the camera and its features', style: 'auditory' },
      { id: 'b', text: 'clear written instructions with lists and bullet points about what to do', style: 'reading' },
      { id: 'c', text: 'diagrams showing the camera and what each part does', style: 'visual' },
      { id: 'd', text: 'many examples of good and poor photos and how to improve them', style: 'kinesthetic' }
    ]
  },
  {
    id: 'q13',
    question: 'Do you prefer a teacher or a presenter who uses:',
    options: [
      { id: 'a', text: 'demonstrations, models or practical sessions', style: 'kinesthetic' },
      { id: 'b', text: 'question and answer, talk, group discussion, or guest speakers', style: 'auditory' },
      { id: 'c', text: 'handouts, books, or readings', style: 'reading' },
      { id: 'd', text: 'diagrams, charts or graphs', style: 'visual' }
    ]
  },
  {
    id: 'q14',
    question: 'You have finished a competition or test and would like some feedback. You would like to have feedback:',
    options: [
      { id: 'a', text: 'using examples from what you have done', style: 'kinesthetic' },
      { id: 'b', text: 'using a written description of your results', style: 'reading' },
      { id: 'c', text: 'from somebody who talks it through with you', style: 'auditory' },
      { id: 'd', text: 'using graphs showing what you had achieved', style: 'visual' }
    ]
  },
  {
    id: 'q15',
    question: 'You are going to choose food at a restaurant or cafe. You would:',
    options: [
      { id: 'a', text: 'choose something that you have had there before', style: 'kinesthetic' },
      { id: 'b', text: 'listen to the waiter or ask friends to recommend choices', style: 'auditory' },
      { id: 'c', text: 'choose from the descriptions in the menu', style: 'reading' },
      { id: 'd', text: 'look at what others are eating or look at pictures of each dish', style: 'visual' }
    ]
  },
  {
    id: 'q16',
    question: 'You have to make an important speech at a conference or special occasion. You would:',
    options: [
      { id: 'a', text: 'make diagrams or get graphs to help explain things', style: 'visual' },
      { id: 'b', text: 'write a few key words and practice saying your speech over and over', style: 'auditory' },
      { id: 'c', text: 'write out your speech and learn from reading it over several times', style: 'reading' },
      { id: 'd', text: 'gather many examples and stories to make the talk real and practical', style: 'kinesthetic' }
    ]
  }
];

// GET /api/learning/assessment/vark - Get VARK questionnaire
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        questions: VARK_QUESTIONS,
        instructions: 'Choose the answer which best explains your preference and circle the letter next to it. Please circle more than one if a single answer does not match your perception. Leave blank any question that does not apply.'
      }
    });
  } catch (error) {
    console.error('Error fetching VARK questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to fetch VARK questionnaire' },
      { status: 500 }
    );
  }
}

// POST /api/learning/assessment/vark - Submit VARK assessment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, responses } = body;
    
    if (!userId || !responses) {
      return NextResponse.json(
        { error: 'User ID and responses are required' },
        { status: 400 }
      );
    }
    
    // Validate responses
    const validResponses: Record<string, string> = {};
    Object.entries(responses).forEach(([questionId, answer]) => {
      if (typeof answer === 'string') {
        validResponses[questionId] = answer;
      }
    });
    
    const assessment = await learningService.processVARKAssessment(userId, validResponses);
    
    return NextResponse.json({
      success: true,
      data: assessment,
      message: 'VARK assessment processed successfully'
    });
  } catch (error) {
    console.error('Error processing VARK assessment:', error);
    return NextResponse.json(
      { error: 'Failed to process VARK assessment' },
      { status: 500 }
    );
  }
}