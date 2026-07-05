from types import SimpleNamespace


def _parent(session_db="parent-db"):
    return SimpleNamespace(
        _delegate_depth=0,
        _fallback_chain=None,
        _session_db=session_db,
        _subagent_id=None,
        api_key="parent-key",
        api_mode="chat_completions",
        base_url="https://parent.example/v1",
        enabled_toolsets=["terminal", "delegation"],
        max_tokens=None,
        model="parent-model",
        platform="desktop",
        prefill_messages=None,
        provider="parent-provider",
        reasoning_config=None,
        session_id="parent-session",
        tool_progress_callback=None,
    )


def test_build_child_agent_binds_studio_profile_home(monkeypatch, tmp_path):
    import hermes_constants
    import tools.delegate_tool as delegate_tool
    import run_agent
    import hermes_state

    root = tmp_path / "root"
    profile_home = root / "profiles" / "qa"
    profile_home.mkdir(parents=True)
    (profile_home / "config.yaml").write_text("model:\n  default: profile-model\n", encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(root))
    created = {}

    class FakeSessionDB:
        def __init__(self):
            created["session_home"] = str(hermes_constants.get_hermes_home())

    class FakeAgent:
        def __init__(self, **kwargs):
            created["agent_home"] = str(hermes_constants.get_hermes_home())
            created["kwargs"] = kwargs
            self.session_id = "child-session"
            self._session_init_model_config = {}

    monkeypatch.setattr(hermes_state, "SessionDB", FakeSessionDB)
    monkeypatch.setattr(run_agent, "AIAgent", FakeAgent)

    child = delegate_tool._build_child_agent(
        task_index=0,
        goal="review UI",
        context=None,
        toolsets=None,
        model=None,
        max_iterations=3,
        task_count=1,
        parent_agent=_parent(),
        target_profile_id="qa",
        target_profile_name="QA Agent",
    )

    assert created["session_home"].endswith("profiles/qa")
    assert created["agent_home"].endswith("profiles/qa")
    assert created["kwargs"]["model"] == "profile-model"
    assert created["kwargs"]["session_db"].__class__ is FakeSessionDB
    assert created["kwargs"]["parent_session_id"] is None
    assert child._session_init_model_config["_studio_agent_run"] is True
    assert child._session_init_model_config["_studio_parent_session_id"] == "parent-session"
    assert child._session_init_model_config["_studio_profile_id"] == "qa"
    assert "_delegate_from" not in child._session_init_model_config


def test_build_child_agent_keeps_generic_delegate_marker(monkeypatch):
    import tools.delegate_tool as delegate_tool
    import run_agent

    created = {}

    class FakeAgent:
        def __init__(self, **kwargs):
            created["kwargs"] = kwargs
            self.session_id = "child-session"
            self._session_init_model_config = {}

    monkeypatch.setattr(run_agent, "AIAgent", FakeAgent)

    child = delegate_tool._build_child_agent(
        task_index=0,
        goal="review UI",
        context=None,
        toolsets=None,
        model=None,
        max_iterations=3,
        task_count=1,
        parent_agent=_parent(),
    )

    assert created["kwargs"]["session_db"] == "parent-db"
    assert created["kwargs"]["parent_session_id"] == "parent-session"
    assert child._session_init_model_config["_delegate_from"] == "parent-session"
    assert "_studio_agent_run" not in child._session_init_model_config
