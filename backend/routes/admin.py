from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
from flask import current_app

@admin_bp.route('/exit-interviews', methods=['GET'])
@jwt_required()
@admin_required
def get_exit_interviews():
    """Get all exit interviews"""
    current_user = get_jwt_identity()
    
    try:
        # Fetch all questionnaire responses 
        questionnaires = mongo.db.questionnaires.find({})
        
        # Convert to list and format response
        questionnaire_list = list(questionnaires)
        
        # Convert ObjectId to string for JSON serialization
        for q in questionnaire_list:
            q['_id'] = str(q['_id'])
            if 'user_id' in q and isinstance(q['user_id'], ObjectId):
                q['user_id'] = str(q['user_id'])
                
        return jsonify(questionnaire_list), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching exit interviews: {str(e)}")
        return jsonify({'msg': 'Error fetching exit interviews', 'error': str(e)}), 500 