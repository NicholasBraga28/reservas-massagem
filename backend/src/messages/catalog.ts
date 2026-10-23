export const messages = {
  errors: {
    notIdentified: "Você ainda não se identificou: escolha um usuário na tela de entrada.",
    identificationNotRecognized:
      "Não encontramos um usuário ativo com essa identificação: escolha um usuário na tela de entrada.",
    accessDenied: "Seu perfil não tem acesso a esta função: volte para a página inicial.",
    invalidPeriod: "O período informado é inválido.",
    invalidReportPeriod: "O período do relatório é inválido. Confira as datas e tente novamente.",
    invalidReportFilter: "Os filtros do relatório são inválidos. Confira as informações e tente novamente.",
    invalidAuditCursor: "Não foi possível continuar a consulta da auditoria. Atualize a lista e tente novamente.",
    locationNotFound: "A unidade selecionada não foi encontrada. Confira a unidade e tente novamente.",
    invalidDuration: "A duração informada é inválida.",
    outsideOperatingHours: "O período está fora do funcionamento ou coincide com o almoço.",
    outsideBookingHorizon: "O período está fora da janela de agendamento.",
    activeBookingLimit: "Você já tem o máximo de reservas futuras. Cancele uma para agendar outra.",
    invalidRoom: "A sala informada não está ativa ou não pertence à disponibilidade.",
    checkInTooEarly: "O check-in ainda não está disponível.",
    noAppointmentForRoom: "Não há uma reserva elegível para este colaborador nesta sala.",
    bookingNotice: "A antecedência mínima para agendamento não foi respeitada.",
    cancellationNotice: "A antecedência mínima para cancelamento não foi respeitada.",
    lateCheckIn: "O limite de atraso para check-in foi excedido.",
    outsideAvailability: "O período não pertence à disponibilidade do massoterapeuta.",
    unavailable: "O horário não está disponível.",
    appointmentNotFound: "Agendamento não encontrado.",
    appointmentCannotCancel: "O agendamento não pode mais ser cancelado.",
    invalidCheckIn: "Código de check-in inválido.",
    checkInUnavailable: "Check-in indisponível para este agendamento.",
    userNotFound: "Usuário não encontrado: atualize a lista e tente novamente.",
    userEmailAlreadyExists: "Já existe um usuário cadastrado com este e-mail.",
    therapistNotFound: "Massoterapeuta não encontrado.",
    therapistInactive: "O massoterapeuta selecionado está inativo.",
    roomNotFound: "Sala não encontrada.",
    roomNameAlreadyExists: "Já existe uma sala com este nome nesta unidade: escolha outro nome.",
    roomInactive: "A sala selecionada está inativa.",
    scheduleNotFound: "Período de agenda não encontrado.",
    scheduleConflictTherapist: "O massoterapeuta já possui outro período de trabalho neste mesmo horário.",
    scheduleConflictRoom: "A sala selecionada já está ocupada por outro período neste mesmo horário.",
    scheduleHasAppointments:
      "Não é possível alterar ou remover este período pois já existem atendimentos agendados nele.",
    therapistProfileNotFound: "Perfil de massoterapeuta não encontrado.",
    sessionCannotStart: "A sessão não pode ser iniciada.",
    sessionNotInProgress: "A sessão não está em andamento.",
    invalidStatusTransition:
      "Esta ação não está disponível para este atendimento agora. Consulte a agenda para ver a situação dele.",
    waitlistEntryNotFound: "Entrada da lista de espera não encontrada.",
    waitlistAlreadyJoined: "Você já está na lista de espera para este horário.",
    waitlistOfferExpired: "A oferta da vaga expirou.",
    waitlistOfferUnavailable: "A vaga já foi aceita por outra pessoa ou não está mais disponível.",
    businessRuleNotFound: "Parâmetro de regra de negócio não encontrado: atualize a lista e tente novamente.",
    invalidBusinessRuleValue: "O valor informado para esta regra de negócio é inválido ou fora dos limites permitidos.",
  },
  businessRules: {
    units: { MINUTES: "minutos", DAYS: "dias", COUNT: "", TIME_OF_DAY: "", WEEKDAYS: "" },
    violations: {
      MISSING: (label: string) => `Informe ${label}.`,
      NOT_NON_NEGATIVE_INTEGER: (subject: string) => `${subject} deve ser um número inteiro igual ou maior que zero.`,
      NOT_POSITIVE: (subject: string) => `${subject} deve ser um número inteiro maior que zero.`,
      NOT_TIME_OF_DAY: (subject: string) => `${subject} deve estar no formato HH:MM, por exemplo 09:00.`,
      OUTSIDE_DAY: (subject: string) => `${subject} deve ser um horário entre 00:00 e 23:59.`,
      NOT_WEEKDAYS: (subject: string) => `${subject} devem ir de 1 (segunda) a 7 (domingo), por exemplo 1,2,3,4,5.`,
      OUT_OF_LIMITS: (subject: string, min: number, max: number, unit: string) =>
        `${subject} deve ficar entre ${min} e ${[max, unit].filter(Boolean).join(" ")}.`,
      NOT_AFTER: (subject: string, ofOther: string) => `${subject} deve ser depois ${ofOther}.`,
      NOT_BEFORE: (subject: string, ofOther: string) => `${subject} deve ser antes ${ofOther}.`,
      BEFORE: (subject: string, ofOther: string) => `${subject} não pode ser antes ${ofOther}.`,
    },
    parameters: {
      bookingMinNoticeMinutes: {
        label: "a antecedência mínima para agendar",
        description: "Antecedência mínima, em minutos, para o colaborador agendar uma sessão.",
      },
      cancellationMinNoticeMinutes: {
        label: "a antecedência mínima para cancelar",
        description: "Antecedência mínima, em minutos, para cancelar uma sessão.",
      },
      lateArrivalToleranceMinutes: {
        label: "a tolerância de atraso",
        description: "Minutos de atraso aceitos no check-in; depois disso, a sessão pode virar ausência.",
      },
      checkInEarlyMinutes: {
        label: "a antecedência máxima do check-in",
        description: "Quantos minutos antes do início da sessão o check-in fica disponível.",
      },
      reminderLeadMinutes: {
        label: "a antecedência do lembrete",
        description: "Quantos minutos antes da sessão o colaborador recebe o lembrete.",
      },
      reminderConfirmationToleranceMinutes: {
        label: "o prazo para confirmar depois do lembrete",
        description: "Minutos que o colaborador tem para confirmar a sessão depois do lembrete.",
      },
      waitlistAcceptanceMinutes: {
        label: "o prazo para aceitar a vaga da lista de espera",
        description: "Minutos que a pessoa da lista de espera tem para aceitar uma vaga liberada.",
      },
      sessionDurationMinutes: {
        label: "a duração da sessão",
        description: "Duração de cada sessão, em minutos.",
      },
      slotStepMinutes: {
        label: "o intervalo entre horários",
        description: "Minutos entre o início de um horário disponível e o início do seguinte.",
      },
      bookingHorizonDays: {
        label: "a janela de agendamento",
        description: "Até quantos dias à frente o colaborador pode agendar.",
      },
      maxActiveBookingsPerEmployee: {
        label: "o limite de reservas por colaborador",
        description: "Quantas reservas futuras ativas cada colaborador pode ter ao mesmo tempo.",
      },
      workDays: {
        label: "os dias de funcionamento",
        description: "Dias da semana com atendimento, de 1 (segunda) a 7 (domingo), separados por vírgula.",
      },
      workStartMinutes: {
        label: "o início do expediente",
        description: "Horário de início do atendimento, no formato HH:MM.",
      },
      lunchStartMinutes: {
        label: "o início do almoço",
        description: "Horário de início do almoço, no formato HH:MM; igual ao fim do almoço quando não há pausa.",
      },
      lunchEndMinutes: {
        label: "o fim do almoço",
        description: "Horário de fim do almoço, no formato HH:MM.",
      },
      workEndMinutes: {
        label: "o fim do expediente",
        description: "Horário de fim do atendimento, no formato HH:MM.",
      },
    },
  },
  roles: {
    spoken: {
      EMPLOYEE: "colaborador",
      THERAPIST: "massoterapeuta",
      HR: "RH",
      ADMIN: "suporte",
    },
  },
  profile: {
    signedInAs: (firstName: string, spokenRole: string) => `Você entrou como ${firstName}, ${spokenRole}.`,
  },
  demoUsers: {
    spokenItem: (name: string, spokenRole: string) => `${name}, ${spokenRole}.`,
  },
  availability: {
    noSlots: "Não há horários disponíveis.",
    summary: (count: number, firstName: string, hour: string) =>
      `Há ${count} ${count === 1 ? "horário disponível" : "horários disponíveis"}. Primeiro: ${firstName}, às ${hour}.`,
  },
  reports: {
    shiftNames: { MORNING: "manhã", AFTERNOON: "tarde" },
    weekdayNames: {
      MONDAY: "segunda-feira",
      TUESDAY: "terça-feira",
      WEDNESDAY: "quarta-feira",
      THURSDAY: "quinta-feira",
      FRIDAY: "sexta-feira",
      SATURDAY: "sábado",
      SUNDAY: "domingo",
    },
    period: (from: string, to: string) => `Período de ${from} a ${to}`,
    shiftSummary: (shift: string, count: number) => `Turno mais procurado: ${shift}, com ${count} agendamentos`,
    weekdaySummary: (weekday: string, count: number) => `Dia com maior volume: ${weekday}, com ${count} agendamentos`,
    startTimeSummary: (time: string, count: number) => `Horário mais procurado: ${time}, com ${count} agendamentos`,
    noShiftDemand: "Sem procura registrada por turno",
    noWeekdayDemand: "Sem procura registrada por dia da semana",
    noStartTimeDemand: "Sem procura registrada por horário",
    cancellationSummary: (cancelled: number, scheduled: number, rate: string) =>
      `Cancelamentos: ${cancelled} de ${scheduled} agendamentos, taxa de ${rate}%`,
    noCancellations: "Não há agendamentos no período para calcular cancelamentos",
    kpiSummary: (period: string, shift: string, weekday: string, startTime: string, cancellations: string) =>
      `${period}. ${shift}. ${weekday}. ${startTime}. ${cancellations}.`,
    auditActionNames: {
      appointmentCreated: "Agendamento criado",
      appointmentCancelled: "Agendamento cancelado",
      appointmentCheckedIn: "Check-in registrado",
      sessionStarted: "Sessão iniciada",
      sessionFinished: "Sessão finalizada",
      sessionAutoCompleted: "Sessão finalizada automaticamente",
    },
    unknownAuditAction: "Evento do agendamento registrado",
    auditEvent: (action: string, dateTime: string, isSystem: boolean) =>
      `${isSystem ? "Evento do sistema: " : ""}${action}, registrado em ${dateTime}.`,
    auditListSummary: (count: number) =>
      count === 0
        ? "Nenhum evento de auditoria no período consultado."
        : `${count} evento${count === 1 ? "" : "s"} de auditoria no período consultado.`,
  },
  booking: {
    confirmed: (therapistName: string, dateTime: string, roomName: string) =>
      `Reserva confirmada para ${dateTime}, com ${therapistName}, na ${roomName}.`,
    cancelled: (therapistName: string, dateTime: string, roomName: string) =>
      `Agendamento cancelado para ${dateTime}, com ${therapistName}, na ${roomName}.`,
  },
  appointments: {
    upcoming: (count: number, therapistName: string, dateTime: string, roomName: string) =>
      `Você tem ${count} ${count === 1 ? "próximo agendamento" : "próximos agendamentos"}. Primeiro: ${therapistName}, ${dateTime}, na ${roomName}.`,
    past: (count: number) => `Você tem ${count} ${count === 1 ? "agendamento anterior" : "agendamentos anteriores"}.`,
    empty: "Você não tem agendamentos.",
  },
  nextAppointment: {
    summary: (therapistName: string, dateTime: string, roomName: string) =>
      `Sua próxima sessão é ${dateTime}, com ${therapistName}, na ${roomName}.`,
    empty: "Você não tem próxima sessão agendada.",
  },
  waitlist: {
    offer: (dateTime: string) =>
      `Uma vaga ficou disponível para você em ${dateTime}. Acesse a página inicial para aceitar ou recusar.`,
  },
  notifications: {
    checkInConfirmed: (dateTime: string, roomName: string) => `Check-in confirmado para ${dateTime}, na ${roomName}.`,
    employeeArrived: (firstName: string, hour: string, roomName: string) =>
      `${firstName} chegou para o atendimento de hoje, às ${hour}, na ${roomName}.`,
    possibleNoShow: (firstName: string, hour: string, roomName: string) =>
      `${firstName} ainda não fez check-in para o atendimento de hoje, às ${hour}, na ${roomName}.`,
  },
} as const;
