// 100 craving alternatives organized by category.
// Pick a random one with pickSuggestion().

export const CATEGORIES = [
  { id: 'physical', name: 'Endorphin Spike', emoji: '💪' },
  { id: 'sensory',  name: 'Dopamine Reset',  emoji: '🧊' },
  { id: 'cognitive', name: 'Focus Loop',      emoji: '🧠' },
  { id: 'microwin', name: 'Micro-Win',        emoji: '✅' },
]

export const SUGGESTIONS = [
  // ─── Physical "Endorphin Spikes" ──────────────────────────────────────
  { id: 1,  cat: 'physical', text: '20 rapid air squats' },
  { id: 2,  cat: 'physical', text: '15 star jumps (jumping jacks)' },
  { id: 3,  cat: 'physical', text: 'Run on the spot with high knees for 30 seconds' },
  { id: 4,  cat: 'physical', text: '10 burpees as fast as possible' },
  { id: 5,  cat: 'physical', text: 'Shadowbox the air for 45 seconds' },
  { id: 6,  cat: 'physical', text: '60-second Wall Sit (hold until legs shake)' },
  { id: 7,  cat: 'physical', text: '15 incline push-ups using a desk' },
  { id: 8,  cat: 'physical', text: '20 Mountain Climbers on the floor' },
  { id: 9,  cat: 'physical', text: '30 seconds of Butt Kicks (running in place)' },
  { id: 10, cat: 'physical', text: 'Hold a plank for 45 seconds' },
  { id: 11, cat: 'physical', text: '15 calf raises (standing on toes)' },
  { id: 12, cat: 'physical', text: '10 tuck jumps (knees to chest)' },
  { id: 13, cat: 'physical', text: '20 lunges (10 per leg)' },
  { id: 14, cat: 'physical', text: 'Sprint to a door and back 3 times' },
  { id: 15, cat: 'physical', text: '15 tricep dips using a chair' },
  { id: 16, cat: 'physical', text: '30 seconds of invisible jump rope' },
  { id: 17, cat: 'physical', text: '10 slow diamond push-ups' },
  { id: 18, cat: 'physical', text: 'Lateral hops over an invisible line for 30s' },
  { id: 19, cat: 'physical', text: '15 bicycle crunches' },
  { id: 20, cat: 'physical', text: 'Hold Superman pose for 30 seconds' },
  { id: 21, cat: 'physical', text: '20 glute bridges' },
  { id: 22, cat: 'physical', text: '10 Spider-man push-ups' },
  { id: 23, cat: 'physical', text: '30 seconds of bear crawl across the room' },
  { id: 24, cat: 'physical', text: '15 side lunges' },
  { id: 25, cat: 'physical', text: '10 inchworms (walk hands out to plank and back)' },

  // ─── Sensory "Dopamine Resets" ────────────────────────────────────────
  { id: 26, cat: 'sensory', text: 'Splash ice-cold water on your face for 10 seconds' },
  { id: 27, cat: 'sensory', text: 'Hold an ice cube in your palm until it melts' },
  { id: 28, cat: 'sensory', text: 'Eat a slice of lemon (peel included)' },
  { id: 29, cat: 'sensory', text: '30-second cold shower blast' },
  { id: 30, cat: 'sensory', text: 'A drop of hot sauce on your tongue' },
  { id: 31, cat: 'sensory', text: 'Smell strong coffee beans or peppermint oil' },
  { id: 32, cat: 'sensory', text: 'Snap a rubber band gently against your wrist' },
  { id: 33, cat: 'sensory', text: 'Brush teeth with intense menthol toothpaste' },
  { id: 34, cat: 'sensory', text: 'Gargle with ice-cold mouthwash' },
  { id: 35, cat: 'sensory', text: 'Chew on a piece of raw ginger' },
  { id: 36, cat: 'sensory', text: 'Step outside into the cold air for 60 seconds' },
  { id: 37, cat: 'sensory', text: 'Foam roll or tennis ball massage a tight muscle' },
  { id: 38, cat: 'sensory', text: 'Pinch the webbing between thumb and index finger 15s' },
  { id: 39, cat: 'sensory', text: 'Bite into a cold, crisp apple' },
  { id: 40, cat: 'sensory', text: 'Listen to one power song at full volume' },
  { id: 41, cat: 'sensory', text: '5 box breaths (In 4s, Hold 4s, Out 4s, Hold 4s)' },
  { id: 42, cat: 'sensory', text: 'Hum a low tone for 30 seconds (Vagus nerve)' },
  { id: 43, cat: 'sensory', text: 'Press your tongue against the roof of your mouth hard' },
  { id: 44, cat: 'sensory', text: 'Rub an ice cube on the back of your neck' },
  { id: 45, cat: 'sensory', text: 'Put on clothing straight from the freezer' },
  { id: 46, cat: 'sensory', text: 'Eat a single extremely sour candy' },
  { id: 47, cat: 'sensory', text: 'Spray a strong, pleasant room mist' },
  { id: 48, cat: 'sensory', text: '60-second scalp massage' },
  { id: 49, cat: 'sensory', text: 'Immerse your hands in a bowl of ice water' },
  { id: 50, cat: 'sensory', text: 'Eat a teaspoon of plain mustard' },

  // ─── Cognitive "Focus Loops" ──────────────────────────────────────────
  { id: 51, cat: 'cognitive', text: 'Stand on one leg, eyes closed, 30 seconds' },
  { id: 52, cat: 'cognitive', text: 'Count backward from 100 by 7s' },
  { id: 53, cat: 'cognitive', text: 'Name 10 cities in alphabetical order' },
  { id: 54, cat: 'cognitive', text: 'Solve one Sudoku or crossword clue' },
  { id: 55, cat: 'cognitive', text: 'Balance a pen on your finger for 45 seconds' },
  { id: 56, cat: 'cognitive', text: 'Write "I am in control" with your non-dominant hand' },
  { id: 57, cat: 'cognitive', text: 'Recite a poem or song lyrics from memory' },
  { id: 58, cat: 'cognitive', text: 'Alphabetize the objects on your desk in your head' },
  { id: 59, cat: 'cognitive', text: '5 things you see, 4 touch, 3 hear, 2 smell, 1 taste' },
  { id: 60, cat: 'cognitive', text: 'Memorize a 5-digit number, recall it in 2 minutes' },
  { id: 61, cat: 'cognitive', text: 'Draw a perfect circle on paper' },
  { id: 62, cat: 'cognitive', text: 'Sort a handful of coins by year' },
  { id: 63, cat: 'cognitive', text: 'Trace the outline of your hand without looking' },
  { id: 64, cat: 'cognitive', text: 'Say the alphabet backward' },
  { id: 65, cat: 'cognitive', text: 'Unlace and re-lace your shoes perfectly' },
  { id: 66, cat: 'cognitive', text: 'Build a tower out of 10 household items' },
  { id: 67, cat: 'cognitive', text: 'Speed-read a random Wikipedia article for 60s' },
  { id: 68, cat: 'cognitive', text: 'Count how many Es are in a paragraph of text' },
  { id: 69, cat: 'cognitive', text: 'Play a brain training game for 1 minute' },
  { id: 70, cat: 'cognitive', text: 'Try to whistle a complex tune perfectly' },
  { id: 71, cat: 'cognitive', text: 'Mentally calculate your taper rank and next step' },
  { id: 72, cat: 'cognitive', text: 'List 5 things you\'ll buy with money saved' },
  { id: 73, cat: 'cognitive', text: 'Solve a puzzle cube side' },
  { id: 74, cat: 'cognitive', text: 'Look at an optical illusion for 30 seconds' },
  { id: 75, cat: 'cognitive', text: 'Try to touch your nose with your tongue' },

  // ─── "Micro-Wins" ─────────────────────────────────────────────────────
  { id: 76,  cat: 'microwin', text: 'Wash exactly 5 dishes' },
  { id: 77,  cat: 'microwin', text: 'Delete 20 junk emails' },
  { id: 78,  cat: 'microwin', text: 'Water one plant' },
  { id: 79,  cat: 'microwin', text: 'Organize one drawer' },
  { id: 80,  cat: 'microwin', text: 'Wipe down your phone and keyboard' },
  { id: 81,  cat: 'microwin', text: 'Make your bed perfectly' },
  { id: 82,  cat: 'microwin', text: 'Take out the trash' },
  { id: 83,  cat: 'microwin', text: 'Hang up 5 pieces of clothing' },
  { id: 84,  cat: 'microwin', text: 'Clean your glasses' },
  { id: 85,  cat: 'microwin', text: 'Send a "Thank you" text to someone' },
  { id: 86,  cat: 'microwin', text: 'File a stray piece of paperwork' },
  { id: 87,  cat: 'microwin', text: 'Clear 5 files from your desktop' },
  { id: 88,  cat: 'microwin', text: 'Refill your water bottle' },
  { id: 89,  cat: 'microwin', text: 'Sharpen all the pencils in the room' },
  { id: 90,  cat: 'microwin', text: 'Fold a single load of laundry' },
  { id: 91,  cat: 'microwin', text: 'Check your pulse and record it' },
  { id: 92,  cat: 'microwin', text: 'Write down your goal for tomorrow' },
  { id: 93,  cat: 'microwin', text: 'Organize your wallet' },
  { id: 94,  cat: 'microwin', text: 'Clean a filter (dryer lint, vacuum, etc.)' },
  { id: 95,  cat: 'microwin', text: 'Sweep one small area of the floor' },
  { id: 96,  cat: 'microwin', text: 'Match 3 pairs of socks' },
  { id: 97,  cat: 'microwin', text: 'Put away one thing that\'s been sitting out' },
  { id: 98,  cat: 'microwin', text: 'Delete one unused app from your phone' },
  { id: 99,  cat: 'microwin', text: '2 minutes of total silence' },
  { id: 100, cat: 'microwin', text: 'Check off "Resisted craving" on paper' },
]

export function pickSuggestion() {
  const idx = Math.floor(Math.random() * SUGGESTIONS.length)
  const s = SUGGESTIONS[idx]
  const cat = CATEGORIES.find(c => c.id === s.cat)
  return { ...s, category: cat }
}

export function pickNumber() {
  return Math.floor(Math.random() * 100) + 1
}
