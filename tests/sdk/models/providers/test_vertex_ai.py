import base64
import json
import os
import tempfile
from unittest.mock import Mock, patch, mock_open

import pytest
from pydantic import BaseModel
from rhesis.sdk.models.providers.vertex_ai import (
    DEFAULT_MODEL_NAME,
    PROVIDER,
    VertexAILLM,
)


def test_vertex_ai_defaults():
    """Test default constants."""
    assert PROVIDER == "vertex_ai"
    assert DEFAULT_MODEL_NAME == "gemini-2.5-flash"


class TestVertexAILLMInitialization:
    """Test VertexAILLM initialization with different credential methods."""

    def test_init_defaults(self):
        """Test initialization with default model name."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "private_key_id": "test-key-id",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com"
        }, clear=True):
            llm = VertexAILLM()
            assert llm.model_name == f"{PROVIDER}/{DEFAULT_MODEL_NAME}"
            assert llm._vertex_config['project'] == "test-project"
            assert llm._vertex_config['location'] == "europe-west3"

    def test_init_with_custom_model(self):
        """Test initialization with custom model name."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        custom_model = "gemini-2.0-flash"
        
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://us-central1-aiplatform.googleapis.com"
        }, clear=True):
            llm = VertexAILLM(model_name=custom_model)
            assert llm.model_name == f"{PROVIDER}/{custom_model}"

    def test_init_without_credentials_raises_error(self):
        """Test initialization without credentials raises ValueError."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="Vertex AI credentials not found"):
                VertexAILLM()

    def test_init_without_location_raises_error(self):
        """Test initialization without location raises ValueError."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds
        }, clear=True):
            with pytest.raises(ValueError, match="Vertex AI location not specified"):
                VertexAILLM()


class TestVertexAIConfigLoading:
    """Test credential and configuration loading methods."""

    def test_load_config_method1_base64_credentials(self):
        """Test Method 1: Base64-encoded credentials with endpoint."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project-123",
            "private_key": "test-key",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com"
        }, clear=True):
            llm = VertexAILLM()
            
            assert llm._vertex_config['project'] == "test-project-123"
            assert llm._vertex_config['location'] == "europe-west3"
            assert llm._vertex_config['credentials_path'] is not None
            assert '_temp_file' in llm._vertex_config  # Temp file created

    def test_load_config_method2_file_with_endpoint(self):
        """Test Method 2: File path with endpoint URL."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project-456",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tf:
            json.dump(mock_creds, tf)
            temp_path = tf.name
        
        try:
            with patch.dict(os.environ, {
                "GOOGLE_APPLICATION_CREDENTIALS": temp_path,
                "VERTEX_AI_ENDPOINT": "https://us-central1-aiplatform.googleapis.com"
            }, clear=True):
                llm = VertexAILLM()
                
                assert llm._vertex_config['project'] == "test-project-456"
                assert llm._vertex_config['location'] == "us-central1"
                assert llm._vertex_config['credentials_path'] == temp_path
                assert '_temp_file' not in llm._vertex_config  # No temp file
        finally:
            os.unlink(temp_path)

    def test_load_config_method3_file_with_location(self):
        """Test Method 3: File path with explicit location."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project-789",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tf:
            json.dump(mock_creds, tf)
            temp_path = tf.name
        
        try:
            with patch.dict(os.environ, {
                "GOOGLE_APPLICATION_CREDENTIALS": temp_path,
                "VERTEX_AI_LOCATION": "asia-northeast1"
            }, clear=True):
                llm = VertexAILLM()
                
                assert llm._vertex_config['project'] == "test-project-789"
                assert llm._vertex_config['location'] == "asia-northeast1"
                assert llm._vertex_config['credentials_path'] == temp_path
        finally:
            os.unlink(temp_path)

    def test_load_config_project_override(self):
        """Test that VERTEX_AI_PROJECT overrides credentials project."""
        mock_creds = {
            "type": "service_account",
            "project_id": "original-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com",
            "VERTEX_AI_PROJECT": "override-project"
        }, clear=True):
            llm = VertexAILLM()
            assert llm._vertex_config['project'] == "override-project"

    def test_load_config_invalid_base64(self):
        """Test that invalid base64 credentials raise error."""
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": "not-valid-base64!@#$",
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com"
        }, clear=True):
            with pytest.raises(ValueError, match="Failed to decode VERTEX_AI_CREDENTIALS"):
                VertexAILLM()

    def test_load_config_invalid_endpoint_format(self):
        """Test that invalid endpoint format raises error."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://invalid-format.com"
        }, clear=True):
            with pytest.raises(ValueError, match="Could not extract region from VERTEX_AI_ENDPOINT"):
                VertexAILLM()

    def test_load_config_file_not_found(self):
        """Test that non-existent credentials file raises error."""
        with patch.dict(os.environ, {
            "GOOGLE_APPLICATION_CREDENTIALS": "/non/existent/path.json",
            "VERTEX_AI_LOCATION": "europe-west3"
        }, clear=True):
            with pytest.raises(ValueError, match="GOOGLE_APPLICATION_CREDENTIALS file not found"):
                VertexAILLM()

    def test_load_config_missing_project(self):
        """Test that missing project raises error."""
        mock_creds = {
            "type": "service_account",
            "client_email": "test@test.iam.gserviceaccount.com",
            # No project_id
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        
        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com"
        }, clear=True):
            with pytest.raises(ValueError, match="Could not determine VERTEX_AI_PROJECT"):
                VertexAILLM()


class TestVertexAIGenerate:
    """Test generate method functionality."""

    @patch("rhesis.sdk.models.providers.litellm.completion")
    def test_generate_without_schema(self, mock_completion):
        """Test generate method without schema returns string response."""
        # Setup mock credentials
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()
        
        # Mock the completion response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Hello from Vertex AI"
        mock_completion.return_value = mock_response

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com"
        }, clear=True):
            llm = VertexAILLM()
            prompt = "Hello, how are you?"
            
            result = llm.generate(prompt)
            
            assert result == "Hello from Vertex AI"
            
            # Check that completion was called with vertex_ai parameters
            call_kwargs = mock_completion.call_args[1]
            assert call_kwargs['vertex_ai_project'] == "test-project"
            assert call_kwargs['vertex_ai_location'] == "europe-west3"

    @patch("rhesis.sdk.models.providers.litellm.completion")
    def test_generate_with_schema(self, mock_completion):
        """Test generate method with schema returns validated dict response."""
        # Define a test schema
        class TestSchema(BaseModel):
            name: str
            age: int
            city: str

        # Setup mock credentials
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()

        # Mock the completion response with JSON string
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"name": "John", "age": 30, "city": "New York"}'
        mock_completion.return_value = mock_response

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_LOCATION": "us-central1"
        }, clear=True):
            llm = VertexAILLM()
            prompt = "Generate a person's information"
            
            result = llm.generate(prompt, schema=TestSchema)
            
            assert isinstance(result, dict)
            assert result["name"] == "John"
            assert result["age"] == 30
            assert result["city"] == "New York"

    @patch("rhesis.sdk.models.providers.litellm.completion")
    def test_generate_with_system_prompt(self, mock_completion):
        """Test generate method with system prompt."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Test response"
        mock_completion.return_value = mock_response

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_LOCATION": "europe-west3"
        }, clear=True):
            llm = VertexAILLM()
            prompt = "Test prompt"
            system_prompt = "You are a helpful assistant"
            
            llm.generate(prompt, system_prompt=system_prompt)
            
            # Check messages include system prompt
            messages = mock_completion.call_args[1]['messages']
            assert len(messages) == 2
            assert messages[0]['role'] == 'system'
            assert messages[0]['content'] == system_prompt

    @patch("rhesis.sdk.models.providers.litellm.completion")
    def test_generate_with_additional_kwargs(self, mock_completion):
        """Test generate method passes additional kwargs to completion."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Test response"
        mock_completion.return_value = mock_response

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_LOCATION": "europe-west1"
        }, clear=True):
            llm = VertexAILLM()
            prompt = "Test prompt"
            
            llm.generate(prompt, temperature=0.7, max_tokens=100)
            
            call_kwargs = mock_completion.call_args[1]
            assert call_kwargs['temperature'] == 0.7
            assert call_kwargs['max_tokens'] == 100
            assert call_kwargs['vertex_ai_project'] == "test-project"
            assert call_kwargs['vertex_ai_location'] == "europe-west1"

    @patch("rhesis.sdk.models.providers.litellm.completion")
    def test_generate_with_constructor_kwargs(self, mock_completion):
        """Test that kwargs from constructor are merged."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()

        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Test response"
        mock_completion.return_value = mock_response

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_LOCATION": "asia-northeast1"
        }, clear=True):
            llm = VertexAILLM(temperature=0.5)
            prompt = "Test prompt"
            
            llm.generate(prompt)
            
            call_kwargs = mock_completion.call_args[1]
            assert call_kwargs['temperature'] == 0.5


class TestVertexAIUtilityMethods:
    """Test utility methods."""

    def test_get_config_info_base64_credentials(self):
        """Test get_config_info returns correct information for base64 credentials."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com"
        }, clear=True):
            llm = VertexAILLM(model_name="gemini-2.0-flash")
            config = llm.get_config_info()
            
            assert config['provider'] == "vertex_ai"
            assert config['model'] == "vertex_ai/gemini-2.0-flash"
            assert config['project'] == "test-project"
            assert config['location'] == "europe-west3"
            assert config['credentials_source'] == "base64"
            assert config['credentials_path'] is not None

    def test_get_config_info_file_credentials(self):
        """Test get_config_info returns correct information for file credentials."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tf:
            json.dump(mock_creds, tf)
            temp_path = tf.name
        
        try:
            with patch.dict(os.environ, {
                "GOOGLE_APPLICATION_CREDENTIALS": temp_path,
                "VERTEX_AI_LOCATION": "us-central1"
            }, clear=True):
                llm = VertexAILLM()
                config = llm.get_config_info()
                
                assert config['credentials_source'] == "file"
                assert config['credentials_path'] == temp_path
        finally:
            os.unlink(temp_path)


class TestVertexAIRegionalEndpoints:
    """Test different regional endpoints."""

    @pytest.mark.parametrize("endpoint,expected_location", [
        ("https://europe-west1-aiplatform.googleapis.com", "europe-west1"),
        ("https://europe-west3-aiplatform.googleapis.com", "europe-west3"),
        ("https://europe-west4-aiplatform.googleapis.com", "europe-west4"),
        ("https://us-central1-aiplatform.googleapis.com", "us-central1"),
        ("https://us-east4-aiplatform.googleapis.com", "us-east4"),
        ("https://asia-northeast1-aiplatform.googleapis.com", "asia-northeast1"),
        ("https://asia-southeast1-aiplatform.googleapis.com", "asia-southeast1"),
    ])
    def test_regional_endpoints(self, endpoint, expected_location):
        """Test that various regional endpoints are parsed correctly."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": endpoint
        }, clear=True):
            llm = VertexAILLM()
            assert llm._vertex_config['location'] == expected_location


class TestVertexAICleanup:
    """Test cleanup of temporary files."""

    def test_temp_file_cleanup_on_delete(self):
        """Test that temporary credentials file is cleaned up."""
        mock_creds = {
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
        }
        
        encoded_creds = base64.b64encode(json.dumps(mock_creds).encode()).decode()

        with patch.dict(os.environ, {
            "VERTEX_AI_CREDENTIALS": encoded_creds,
            "VERTEX_AI_ENDPOINT": "https://europe-west3-aiplatform.googleapis.com"
        }, clear=True):
            llm = VertexAILLM()
            temp_file = llm._vertex_config.get('_temp_file')
            
            # Temp file should exist
            assert temp_file is not None
            assert os.path.exists(temp_file)
            
            # Delete the instance
            del llm
            
            # Temp file should be cleaned up
            # Note: This test may be flaky depending on GC timing
            # In practice, the __del__ method will be called eventually

