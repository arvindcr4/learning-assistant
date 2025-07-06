// VARK Learning Style Assessment Questionnaire
// Based on the official VARK questionnaire by Neil Fleming

export interface VARKQuestion {
  id: string;
  question: string;
  options: VARKOption[];
  category: 'situation' | 'preference' | 'processing' | 'memory';
}

export interface VARKOption {
  id: string;
  text: string;
  style: 'Visual' | 'Auditory' | 'Reading' | 'Kinesthetic';
  weight: number; // 0.5-1.0 for mixed responses
}

export interface VARKResponse {
  questionId: string;
  selectedOptions: string[]; // Multiple selections allowed
}

export interface VARKResults {
  visual: number;
  auditory: number;
  reading: number;
  kinesthetic: number;
  totalResponses: number;
  dominantStyle: string;
  isMultimodal: boolean;
  confidence: number;
}

export const VARK_QUESTIONNAIRE: VARKQuestion[] = [
  {
    id: 'q1',
    question: 'You are helping someone who wants to go to your airport, the center of town, or railway station. You would:',
    category: 'situation',
    options: [
      { id: 'q1a', text: 'Draw or give them a map', style: 'Visual', weight: 1.0 },
      { id: 'q1b', text: 'Tell them the directions', style: 'Auditory', weight: 1.0 },
      { id: 'q1c', text: 'Write down the directions', style: 'Reading', weight: 1.0 },
      { id: 'q1d', text: 'Go with them or send them to a cab', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q2',
    question: 'You are not sure whether a word should be spelled "dependent" or "dependant." You would:',
    category: 'processing',
    options: [
      { id: 'q2a', text: 'See the word in my mind and choose by the way it looks', style: 'Visual', weight: 1.0 },
      { id: 'q2b', text: 'Sound it out in my mind', style: 'Auditory', weight: 1.0 },
      { id: 'q2c', text: 'Look it up in the dictionary', style: 'Reading', weight: 1.0 },
      { id: 'q2d', text: 'Write both versions down and choose one', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q3',
    question: 'You are planning a holiday for a group. You want some feedback from them about the plan. You would:',
    category: 'preference',
    options: [
      { id: 'q3a', text: 'Use a map or website to show them the places', style: 'Visual', weight: 1.0 },
      { id: 'q3b', text: 'Phone, text, or email them', style: 'Auditory', weight: 0.5 },
      { id: 'q3c', text: 'Give them a copy of the printed itinerary', style: 'Reading', weight: 1.0 },
      { id: 'q3d', text: 'Describe some of the highlights', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q4',
    question: 'You are going to cook something as a special treat. You would:',
    category: 'processing',
    options: [
      { id: 'q4a', text: 'Look at a cookbook for ideas from the pictures', style: 'Visual', weight: 1.0 },
      { id: 'q4b', text: 'Ask friends for suggestions', style: 'Auditory', weight: 1.0 },
      { id: 'q4c', text: 'Use a cookbook where you know there is a good recipe', style: 'Reading', weight: 1.0 },
      { id: 'q4d', text: 'Cook something you know without the need for instructions', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q5',
    question: 'A group of tourists wants to learn about the parks or wildlife reserves in your area. You would:',
    category: 'situation',
    options: [
      { id: 'q5a', text: 'Show them internet pictures, photographs, or picture books', style: 'Visual', weight: 1.0 },
      { id: 'q5b', text: 'Talk about or arrange a talk for them about parks or wildlife reserves', style: 'Auditory', weight: 1.0 },
      { id: 'q5c', text: 'Give them a book or pamphlets about the parks or wildlife reserves', style: 'Reading', weight: 1.0 },
      { id: 'q5d', text: 'Take them to a park or wildlife reserve and walk with them', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q6',
    question: 'You are about to purchase a digital camera or mobile phone. Other than price, what would most influence your decision?',
    category: 'preference',
    options: [
      { id: 'q6a', text: 'The salesperson telling me about its features', style: 'Auditory', weight: 1.0 },
      { id: 'q6b', text: 'Reading the details or checking its features online', style: 'Reading', weight: 1.0 },
      { id: 'q6c', text: 'Playing with it or testing it', style: 'Kinesthetic', weight: 1.0 },
      { id: 'q6d', text: 'Its look and feel', style: 'Visual', weight: 1.0 }
    ]
  },
  {
    id: 'q7',
    question: 'Remember a time when you learned how to do something new. Avoid choosing a physical skill, like riding a bike. You learned best by:',
    category: 'memory',
    options: [
      { id: 'q7a', text: 'Watching a demonstration', style: 'Visual', weight: 1.0 },
      { id: 'q7b', text: 'Listening to somebody explaining it and asking questions', style: 'Auditory', weight: 1.0 },
      { id: 'q7c', text: 'Reading written instructions', style: 'Reading', weight: 1.0 },
      { id: 'q7d', text: 'Doing it or trying it', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q8',
    question: 'You have a problem with your heart. You would prefer that the doctor:',
    category: 'preference',
    options: [
      { id: 'q8a', text: 'Gave you a website or something to read about it', style: 'Reading', weight: 1.0 },
      { id: 'q8b', text: 'Used a plastic model to show what was wrong', style: 'Kinesthetic', weight: 1.0 },
      { id: 'q8c', text: 'Described what was wrong', style: 'Auditory', weight: 1.0 },
      { id: 'q8d', text: 'Showed you a diagram of what was wrong', style: 'Visual', weight: 1.0 }
    ]
  },
  {
    id: 'q9',
    question: 'You want to learn a new program, skill, or game on a computer. You would:',
    category: 'processing',
    options: [
      { id: 'q9a', text: 'Read the written instructions that came with the program', style: 'Reading', weight: 1.0 },
      { id: 'q9b', text: 'Talk with people who know about the program', style: 'Auditory', weight: 1.0 },
      { id: 'q9c', text: 'Use the controls or keyboard', style: 'Kinesthetic', weight: 1.0 },
      { id: 'q9d', text: 'Follow the diagrams in the book that came with it', style: 'Visual', weight: 1.0 }
    ]
  },
  {
    id: 'q10',
    question: 'I like websites that have:',
    category: 'preference',
    options: [
      { id: 'q10a', text: 'Things I can click on, shift, or try', style: 'Kinesthetic', weight: 1.0 },
      { id: 'q10b', text: 'Interesting design and visual features', style: 'Visual', weight: 1.0 },
      { id: 'q10c', text: 'Interesting written descriptions, lists, and explanations', style: 'Reading', weight: 1.0 },
      { id: 'q10d', text: 'Audio channels where I can hear music, radio programs, or interviews', style: 'Auditory', weight: 1.0 }
    ]
  },
  {
    id: 'q11',
    question: 'Other than price, what would most influence your decision to buy a new non-fiction book?',
    category: 'preference',
    options: [
      { id: 'q11a', text: 'The way it looks is appealing', style: 'Visual', weight: 1.0 },
      { id: 'q11b', text: 'Quickly reading parts of it', style: 'Reading', weight: 1.0 },
      { id: 'q11c', text: 'A friend talks about it and recommends it', style: 'Auditory', weight: 1.0 },
      { id: 'q11d', text: 'It has real-life stories, experiences, and examples', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q12',
    question: 'You are using a book, CD, or website to learn how to take photos with your new digital camera. You would like to have:',
    category: 'processing',
    options: [
      { id: 'q12a', text: 'A chance to ask questions and talk about the cameras and its features', style: 'Auditory', weight: 1.0 },
      { id: 'q12b', text: 'Clear written instructions with lists and bullet points about what to do', style: 'Reading', weight: 1.0 },
      { id: 'q12c', text: 'Diagrams showing the camera and what each part does', style: 'Visual', weight: 1.0 },
      { id: 'q12d', text: 'Many examples of good and poor photos and how to improve them', style: 'Kinesthetic', weight: 1.0 }
    ]
  },
  {
    id: 'q13',
    question: 'Do you prefer a teacher or a presenter who uses:',
    category: 'preference',
    options: [
      { id: 'q13a', text: 'Demonstrations, models, or practical sessions', style: 'Kinesthetic', weight: 1.0 },
      { id: 'q13b', text: 'Question and answer, talk, group discussion, or guest speakers', style: 'Auditory', weight: 1.0 },
      { id: 'q13c', text: 'Handouts, books, or readings', style: 'Reading', weight: 1.0 },
      { id: 'q13d', text: 'Diagrams, charts, or graphs', style: 'Visual', weight: 1.0 }
    ]
  },
  {
    id: 'q14',
    question: 'You have finished a competition or test and would like some feedback. You would like to have feedback:',
    category: 'memory',
    options: [
      { id: 'q14a', text: 'Using examples from what you have done', style: 'Kinesthetic', weight: 1.0 },
      { id: 'q14b', text: 'Using a written description of your results', style: 'Reading', weight: 1.0 },
      { id: 'q14c', text: 'From somebody who talks it through with you', style: 'Auditory', weight: 1.0 },
      { id: 'q14d', text: 'Using graphs showing what you had achieved', style: 'Visual', weight: 1.0 }
    ]
  },
  {
    id: 'q15',
    question: 'You are going to choose food at a restaurant or cafe. You would:',
    category: 'situation',
    options: [
      { id: 'q15a', text: 'Choose from the descriptions in the menu', style: 'Reading', weight: 1.0 },
      { id: 'q15b', text: 'Listen to the waiter or ask friends to recommend choices', style: 'Auditory', weight: 1.0 },
      { id: 'q15c', text: 'Choose something that you have had there before', style: 'Kinesthetic', weight: 1.0 },
      { id: 'q15d', text: 'Look at what others are eating or look at pictures of each dish', style: 'Visual', weight: 1.0 }
    ]
  },
  {
    id: 'q16',
    question: 'You have to make an important speech at a conference or special occasion. You would:',
    category: 'memory',
    options: [
      { id: 'q16a', text: 'Make diagrams or get graphs to help explain things', style: 'Visual', weight: 1.0 },
      { id: 'q16b', text: 'Write a few key words and practice saying your speech over and over', style: 'Auditory', weight: 1.0 },
      { id: 'q16c', text: 'Write out your speech and learn from reading it over several times', style: 'Reading', weight: 1.0 },
      { id: 'q16d', text: 'Gather many examples and stories to make the talk real and practical', style: 'Kinesthetic', weight: 1.0 }
    ]
  }
];

export class VARKAssessment {
  /**
   * Calculates VARK scores from user responses
   */
  static calculateScores(responses: VARKResponse[]): VARKResults {
    const scores = {
      visual: 0,
      auditory: 0,
      reading: 0,
      kinesthetic: 0
    };

    let totalResponses = 0;

    responses.forEach(response => {
      const question = VARK_QUESTIONNAIRE.find(q => q.id === response.questionId);
      if (!question) return;

      response.selectedOptions.forEach(optionId => {
        const option = question.options.find(opt => opt.id === optionId);
        if (!option) return;

        const weight = option.weight;
        totalResponses += weight;

        switch (option.style) {
          case 'Visual':
            scores.visual += weight;
            break;
          case 'Auditory':
            scores.auditory += weight;
            break;
          case 'Reading':
            scores.reading += weight;
            break;
          case 'Kinesthetic':
            scores.kinesthetic += weight;
            break;
        }
      });
    });

    // Normalize scores to percentages
    if (totalResponses > 0) {
      scores.visual = Math.round((scores.visual / totalResponses) * 100);
      scores.auditory = Math.round((scores.auditory / totalResponses) * 100);
      scores.reading = Math.round((scores.reading / totalResponses) * 100);
      scores.kinesthetic = Math.round((scores.kinesthetic / totalResponses) * 100);
    }

    // Determine dominant style
    const dominantStyle = this.getDominantStyle(scores);
    
    // Check if multimodal (no single style dominates significantly)
    const isMultimodal = this.isMultimodal(scores);
    
    // Calculate confidence based on response completeness and consistency
    const confidence = this.calculateConfidence(responses, scores);

    return {
      ...scores,
      totalResponses,
      dominantStyle,
      isMultimodal,
      confidence
    };
  }

  /**
   * Determines the dominant learning style
   */
  private static getDominantStyle(scores: { visual: number; auditory: number; reading: number; kinesthetic: number }): string {
    const styles = Object.entries(scores);
    const maxScore = Math.max(...styles.map(([, score]) => score));
    const dominantStyles = styles.filter(([, score]) => score === maxScore);
    
    if (dominantStyles.length === 1) {
      return dominantStyles[0][0];
    } else {
      // If tied, return combined style
      return dominantStyles.map(([style]) => style).join('/');
    }
  }

  /**
   * Checks if the learner is multimodal
   */
  private static isMultimodal(scores: { visual: number; auditory: number; reading: number; kinesthetic: number }): boolean {
    const scoreValues = Object.values(scores);
    const maxScore = Math.max(...scoreValues);
    const highScores = scoreValues.filter(score => score >= maxScore * 0.8);
    
    return highScores.length > 1;
  }

  /**
   * Calculates confidence score based on response quality
   */
  private static calculateConfidence(responses: VARKResponse[], scores: { visual: number; auditory: number; reading: number; kinesthetic: number }): number {
    // Base confidence on response completeness
    const completeness = responses.length / VARK_QUESTIONNAIRE.length;
    
    // Adjust based on score distribution (more consistent = higher confidence)
    const scoreValues = Object.values(scores);
    const maxScore = Math.max(...scoreValues);
    const minScore = Math.min(...scoreValues);
    const distribution = maxScore > 0 ? (maxScore - minScore) / maxScore : 0;
    
    // Higher distribution = more decisive = higher confidence
    const confidence = completeness * (0.5 + distribution * 0.5);
    
    return Math.round(confidence * 100);
  }

  /**
   * Generates learning style recommendations based on VARK results
   */
  static generateRecommendations(results: VARKResults): string[] {
    const recommendations: string[] = [];
    
    if (results.visual >= 30) {
      recommendations.push(
        'Use visual aids like diagrams, charts, and mind maps',
        'Highlight key information with colors and symbols',
        'Watch educational videos and visual demonstrations'
      );
    }
    
    if (results.auditory >= 30) {
      recommendations.push(
        'Participate in discussions and study groups',
        'Use audio recordings and podcasts for learning',
        'Read aloud or explain concepts to others'
      );
    }
    
    if (results.reading >= 30) {
      recommendations.push(
        'Take detailed notes and create written summaries',
        'Use textbooks and written materials as primary sources',
        'Make lists and organize information in written format'
      );
    }
    
    if (results.kinesthetic >= 30) {
      recommendations.push(
        'Use hands-on activities and experiments',
        'Take breaks to move around during study sessions',
        'Use real-world examples and case studies'
      );
    }
    
    if (results.isMultimodal) {
      recommendations.push(
        'Combine multiple learning approaches for best results',
        'Adapt your study method based on the type of material',
        'Use variety in your learning activities to maintain engagement'
      );
    }
    
    return recommendations;
  }

  /**
   * Validates VARK responses for completeness and consistency
   */
  static validateResponses(responses: VARKResponse[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (responses.length < VARK_QUESTIONNAIRE.length * 0.8) {
      errors.push('Please complete at least 80% of the questionnaire for accurate results');
    }
    
    const invalidResponses = responses.filter(response => {
      const question = VARK_QUESTIONNAIRE.find(q => q.id === response.questionId);
      return !question || response.selectedOptions.length === 0;
    });
    
    if (invalidResponses.length > 0) {
      errors.push(`${invalidResponses.length} questions have invalid responses`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}