from rhesis.sdk.models.providers.huggingface import HuggingFaceLLM


class Hermes3(HuggingFaceLLM):
    """
    tag: working
    A specific implementation for the Hermes3 model.
    This class extends HuggingFaceLLM to provide model-specific arguments.
    """

    def __init__(self):
        super().__init__(
            model_name="NousResearch/Hermes-3-Llama-3.2-3B",
            auto_loading=False,
            default_kwargs={
                "repetition_penalty": 1.1,
                "temperature": 0.8,
                "do_sample": True,
            },
        )
