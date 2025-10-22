import pytest
from rhesis.sdk.metrics.base import BaseMetric, MetricConfig, MetricType, ScoreType
from rhesis.sdk.models.providers.gemini import GeminiLLM
from rhesis.sdk.models.providers.native import RhesisLLM


def test_metric_config_defaults():
    config = MetricConfig(evaluation_prompt="test")
    assert config.backend == "rhesis"


def test_metric_config_with_backend():
    config = MetricConfig(evaluation_prompt="test", backend="rhesis")
    assert config.backend == "rhesis"
    config = MetricConfig(evaluation_prompt="test", backend="deepeval")
    assert config.backend == "deepeval"


def test_metric_config_with_score_type():
    config = MetricConfig(evaluation_prompt="test", score_type=ScoreType.NUMERIC)
    assert config.score_type == "numeric"
    config = MetricConfig(evaluation_prompt="test", score_type="numeric")
    assert config.score_type == "numeric"


def test_metric_config_with_metric_type():
    config = MetricConfig(evaluation_prompt="test", metric_type=MetricType.GENERATION)
    assert config.metric_type == "generation"
    config = MetricConfig(evaluation_prompt="test", metric_type="generation")
    assert config.metric_type == "generation"


def test_metric_config_with_invalid_backend():
    with pytest.raises(ValueError):
        MetricConfig(evaluation_prompt="test", backend="invalid")


def test_metric_config_with_invalid_score_type():
    with pytest.raises(ValueError):
        MetricConfig(evaluation_prompt="test", score_type="invalid")


def test_metric_config_with_invalid_metric_type():
    with pytest.raises(ValueError):
        MetricConfig(evaluation_prompt="test", metric_type="invalid")


def test_base_metric_init(monkeypatch):
    monkeypatch.setenv("RHESIS_API_KEY", "test")

    class TestMetric(BaseMetric):
        def evaluate(self):
            pass

    metric = TestMetric(
        name="test",
        description="test description",
        score_type="numeric",
        metric_type="generation",
    )
    assert metric.name == "test"
    assert metric.description == "test description"
    assert metric.score_type == ScoreType.NUMERIC
    assert metric.metric_type == MetricType.GENERATION


def test_base_set_model(monkeypatch):
    monkeypatch.setenv("RHESIS_API_KEY", "test")
    monkeypatch.setenv("GEMINI_API_KEY", "test")

    class TestMetric(BaseMetric):
        def evaluate(self):
            pass

    metric = TestMetric(
        name="test",
        description="test description",
        score_type="numeric",
        metric_type="generation",
    )
    # Test default model
    model = metric.set_model(None)
    assert isinstance(model, RhesisLLM)

    model = metric.set_model("gemini")
    assert isinstance(model, GeminiLLM)

    model = metric.set_model(GeminiLLM())
    assert isinstance(model, GeminiLLM)


def test_base_metric_model_in_init(monkeypatch):
    monkeypatch.setenv("RHESIS_API_KEY", "test")
    monkeypatch.setenv("GEMINI_API_KEY", "test")

    class TestMetric(BaseMetric):
        def evaluate(self):
            pass

    metric = TestMetric(model=None)
    assert isinstance(metric.model, RhesisLLM)
    metric = TestMetric(model="gemini")
    assert isinstance(metric.model, GeminiLLM)
    metric = TestMetric(model=GeminiLLM())
    assert isinstance(metric.model, GeminiLLM)
