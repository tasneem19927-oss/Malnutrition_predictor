@app.route('/predict_enhanced', methods=['POST'])
def enhanced_prediction():
    data = request.json
    ml_prediction = predict_malnutrition(data)
    rag_explanation = rag_system.query(ml_prediction, data)
    medical_entities = biobert.extract_entities(data['notes'])
    
    return {
        'ml_prediction': ml_prediction,
        'scientific_evidence': rag_explanation,
        'medical_entities': medical_entities,
        'treatment_plan': generate_treatment_plan()
    }
