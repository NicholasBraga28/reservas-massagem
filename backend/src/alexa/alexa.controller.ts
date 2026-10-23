import { Body, Controller, Post } from "@nestjs/common";
import { SkillBuilders, HandlerInput } from "ask-sdk-core";
import { RequestEnvelope, Response } from "ask-sdk-model";
import { Public } from "../auth/decorators/public.decorator";
import { TherapistService } from "../therapist/therapist.service";

const escapeSsml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const speech = (text: string): Response => ({
  outputSpeech: { type: "SSML", ssml: `<speak>${escapeSsml(text)}</speak>` },
  shouldEndSession: true,
});
const slot = (input: HandlerInput, name: string) =>
  input.requestEnvelope.request.type === "IntentRequest"
    ? input.requestEnvelope.request.intent.slots?.[name]?.value
    : undefined;

@Public()
@Controller("alexa")
export class AlexaController {
  private readonly skill;

  constructor(private readonly therapists: TherapistService) {
    const builder = SkillBuilders.custom();
    const userId = (input: HandlerInput) => {
      const alexaId = input.requestEnvelope.context?.System?.user?.userId;
      if (!alexaId) return undefined;
      const mapping = process.env.ALEXA_USER_MAP?.trim();
      const isSimulatorUsingApplicationUserId = !mapping;
      if (isSimulatorUsingApplicationUserId) return alexaId;
      try {
        return JSON.parse(mapping)[alexaId] as string | undefined;
      } catch {
        return undefined;
      }
    };
    const withUser = async (input: HandlerInput, action: (id: string) => Promise<Response>) => {
      const id = userId(input);
      if (!id) return speech("Não consegui identificar o seu perfil. Vincule a conta da Alexa ao sistema.");
      try {
        return await action(id);
      } catch {
        return speech("Não consegui consultar a agenda agora. Tente novamente em instantes.");
      }
    };
    const intent = (name: string, action: (input: HandlerInput, id: string) => Promise<Response>) => ({
      canHandle: (input: HandlerInput) =>
        input.requestEnvelope.request.type === "IntentRequest" && input.requestEnvelope.request.intent.name === name,
      handle: (input: HandlerInput) => withUser(input, (id) => action(input, id)),
    });
    const next = intent("ProximoAtendimentoIntent", async (_input, id) => {
      const appointment = await this.therapists.next(id);
      if (!appointment) return speech("Você não tem próximos atendimentos agendados.");
      const time = appointment.startsAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
      return speech(`Seu próximo atendimento é às ${time}, com ${appointment.employee.name}.`);
    });
    const agenda = intent("AgendaDoDiaIntent", async (_input, id) => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const appointments = await this.therapists.agenda(
        id,
        new Date(now.setHours(0, 0, 0, 0)),
        new Date(tomorrow.setHours(0, 0, 0, 0)),
      );
      if (!appointments.length) return speech("Você não tem atendimentos agendados para hoje.");
      const list = appointments
        .map(
          (item) =>
            `${item.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}, ${item.employee.name}`,
        )
        .join("; ");
      return speech(`Sua agenda de hoje tem ${appointments.length} atendimentos: ${list}.`);
    });
    const arrived = intent("QuemChegouIntent", async (_input, id) => {
      const appointments = await this.therapists.arrived(id);
      if (!appointments.length) return speech("Ainda não há clientes confirmados hoje.");
      return speech(`Já chegaram: ${appointments.map((item) => item.employee.name).join(", ")}.`);
    });
    const start = intent("IniciarSessaoIntent", async (input, id) => {
      const appointmentId = slot(input, "appointmentId");
      if (!appointmentId) return speech("Informe o identificador do atendimento.");
      await this.therapists.start(id, appointmentId);
      return speech("Sessão iniciada.");
    });
    const finish = intent("FinalizarSessaoIntent", async (input, id) => {
      const appointmentId = slot(input, "appointmentId");
      if (!appointmentId) return speech("Informe o identificador do atendimento.");
      await this.therapists.finish(id, appointmentId);
      return speech("Sessão finalizada.");
    });
    const cancel = intent("CancelarAtendimentoIntent", async (input, id) => {
      const appointmentId = slot(input, "appointmentId");
      if (!appointmentId) return speech("Informe o identificador do atendimento.");
      await this.therapists.cancel(id, appointmentId);
      return speech("Atendimento cancelado.");
    });
    const fallback = {
      canHandle: (input: HandlerInput) => input.requestEnvelope.request.type === "LaunchRequest",
      handle: () => speech("Olá. Você pode pedir o próximo atendimento, a agenda do dia ou quem já chegou."),
    };
    const help = {
      canHandle: (input: HandlerInput) =>
        input.requestEnvelope.request.type === "IntentRequest" &&
        ["AMAZON.HelpIntent", "AMAZON.FallbackIntent"].includes(input.requestEnvelope.request.intent.name),
      handle: () => speech("Você pode dizer: próximo atendimento, agenda do dia ou quem chegou."),
    };
    const stop = {
      canHandle: (input: HandlerInput) =>
        input.requestEnvelope.request.type === "IntentRequest" &&
        ["AMAZON.StopIntent", "AMAZON.CancelIntent"].includes(input.requestEnvelope.request.intent.name),
      handle: () => speech("Até logo."),
    };
    if (process.env.ALEXA_SKILL_ID) builder.withSkillId(process.env.ALEXA_SKILL_ID);
    this.skill = builder
      .addRequestHandlers(next, agenda, arrived, start, finish, cancel, fallback, help, stop)
      .addErrorHandlers({ canHandle: () => true, handle: () => speech("Ocorreu um erro ao consultar a agenda.") })
      .create();
  }

  @Post()
  handle(@Body() request: RequestEnvelope) {
    return this.skill.invoke(request);
  }
}
