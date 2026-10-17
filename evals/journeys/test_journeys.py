"""Real gateway readiness checks; these do not verify pending full journeys."""


def journey(identifier):
    def register(function):
        function.journey_id = identifier
        return function

    return register


@journey("J1")
def test_install(context):
    context.health()
    context.assert_blocked("J1")


@journey("J2")
def test_first_run(context):
    context.models()
    context.assert_blocked("J2")


@journey("J3")
def test_chat(context):
    context.models()
    context.require_list("/v1/conversations", "data")


@journey("J4")
def test_knowledge(context):
    context.require_list("/v1/workspaces", "data")
    context.assert_blocked("J4")


@journey("J5")
def test_voice(context):
    context.assert_blocked("J5")


@journey("J6")
def test_meetings(context):
    context.require_list("/v1/workspaces", "data")
    context.assert_blocked("J6")


@journey("J7")
def test_vision(context):
    context.assert_blocked("J7")


@journey("J8")
def test_agents(context):
    context.assert_blocked("J8")


@journey("J9")
def test_privacy(context):
    context.health()
    context.assert_blocked("J9")


@journey("J10")
def test_cloud(context):
    context.assert_blocked("J10")


@journey("J11")
def test_management(context):
    context.get("/v1/preferences")
    context.require_list("/v1/profiles", "data")
    context.assert_blocked("J11")


@journey("J12")
def test_recovery(context):
    context.require_unauthorized()
    context.assert_blocked("J12")
