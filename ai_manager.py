import google.generativeai as genai
import json

# ============ 여기에 Gemini API 키 입력 ============
API_KEY = "GEMINI_API_KEY"
# =================================================

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash') 

def build_system_prompt(language, situation, custom_prompt):
    lang_names = {
        'en': 'English', 'ko': 'Korean', 'ja': 'Japanese',
        'zh': 'Chinese', 'es': 'Spanish', 'fr': 'French',
        'de': 'German', 'vi': 'Vietnamese'
    }
    lang_name = lang_names.get(language, language)
    
    situations = {
        'daily': 'daily conversation',
        'business': 'business/office conversation',
        'travel': 'travel conversation',
        'restaurant': 'restaurant ordering',
        'shopping': 'shopping',
        'hospital': 'hospital/pharmacy',
        'hotel': 'hotel check-in/service'
    }
    sit_name = situations.get(situation, 'general conversation')
    
    prompt = f"""You are a friendly {lang_name} language tutor helping students practice conversation.

Current situation: {sit_name}
{f"Additional context: {custom_prompt}" if custom_prompt else ""}

Guidelines:
1. Speak primarily in {lang_name}, keeping responses natural and conversational
2. Match the complexity to the student's level based on their responses
3. Stay in character for the situation (e.g., as a barista, hotel receptionist, etc.)
4. Keep responses concise (1-3 sentences typically)
5. Be encouraging and patient"""
    
    return prompt

def get_ai_response(messages, system_prompt):
    conversation = system_prompt + "\n\n"
    for msg in messages:
        role = "Student" if msg['role'] == 'user' else "Tutor"
        conversation += f"{role}: {msg['content']}\n"
    
    if not messages:
        conversation += "\nStart the conversation with a friendly greeting appropriate for the situation."
    
    response = model.generate_content(conversation)
    return response.text

def get_ai_response_with_feedback(messages, system_prompt, language, user_input):
    lang_names = {
        'en': 'English', 'ko': 'Korean', 'ja': 'Japanese',
        'zh': 'Chinese', 'es': 'Spanish', 'fr': 'French',
        'de': 'German', 'vi': 'Vietnamese'
    }
    lang_name = lang_names.get(language, language)
    
    conversation = system_prompt + "\n\n"
    for msg in messages:
        role = "Student" if msg['role'] == 'user' else "Tutor"
        conversation += f"{role}: {msg['content']}\n"
    
    feedback_prompt = f"""{conversation}

IMPORTANT: Respond in JSON format ONLY with these fields:
1. "response": Your natural conversation response in {lang_name}
2. "feedbacks": Array of feedback objects, each with:
   - "type": either "suggestion" (better expression) or "correction" (grammar/error fix)
   - "content": the feedback in Korean explanation with the correct {lang_name} expression

Analyze the student's last message: "{user_input}"
- If there are grammatical errors, add a "correction" feedback
- If there's a more natural/polite way to say it, add a "suggestion" feedback
- If the message is perfect, feedbacks can be empty array

Respond with ONLY valid JSON, no markdown or extra text:
{{"response": "your response here", "feedbacks": [{{"type": "suggestion", "content": "feedback here"}}]}}"""

    response = model.generate_content(feedback_prompt)
    response_text = response.text.strip()
    
    try:
        # JSON 파싱 전처리
        if '```' in response_text:
            parts = response_text.split('```')
            for part in parts:
                if part.strip().startswith('json'):
                    response_text = part.strip()[4:].strip()
                    break
                elif part.strip().startswith('{'):
                    response_text = part.strip()
                    break
        
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            response_text = response_text[start_idx:end_idx + 1]
        
        result = json.loads(response_text)
        
        if 'response' not in result:
            return {"response": response.text, "feedbacks": []}
        
        if 'feedbacks' not in result:
            result['feedbacks'] = []
            
        return result
    except Exception as e:
        print(f"JSON 파싱 오류: {e}")
        return {"response": response.text, "feedbacks": []}