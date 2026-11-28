/**
 * Editor da mensagem de retorno do CRM (Clientes › cliente › Editar mensagem).
 * A mesma mensagem vale no app e no teclado ("Enviar mensagem de retorno").
 * O botão "Nome do cliente" põe {{cliente}} onde está o cursor: na hora de
 * enviar, vira o primeiro nome de cada cliente.
 */
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, typography, useColors } from '../../keyboard/theme';
import { Repo } from '../../storage/storage';
import type { SegmentId } from '../../types';
import { CLIENT_VAR, defaultFollowUp, formatFollowUp } from '../../utils/formatters';
import { Button, Card, CardText, CardTitle, Page, SubHeader } from '../components/ui';

interface Props {
  segment: SegmentId;
  /** Nome usado na prévia (o do cliente aberto). */
  exampleName: string;
  onBack: () => void;
}

export function FollowUpEditor({ segment, exampleName, onBack }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [text, setText] = useState(() => Repo.getFollowUpTemplate() || defaultFollowUp(segment));
  const [selection, setSelection] = useState({ start: text.length, end: text.length });

  const insertClientName = () => {
    const { start, end } = selection;
    // Espaço antes quando o cursor está grudado numa palavra
    const before = text.slice(0, start);
    const glue = before && !/\s$/.test(before) ? ' ' : '';
    const next = before + glue + CLIENT_VAR + text.slice(end);
    const cursor = start + glue.length + CLIENT_VAR.length;
    setText(next);
    setSelection({ start: cursor, end: cursor });
  };

  const save = () => {
    // Igual à padrão: não guarda (se o ramo ou o idioma mudar, a padrão acompanha)
    Repo.setFollowUpTemplate(text.trim() === defaultFollowUp(segment).trim() ? '' : text);
    onBack();
  };

  const first = exampleName.split(/\s+/)[0] || t('Ana');
  const preview = formatFollowUp(first, segment, text, Repo.getSeller());

  return (
    <Page>
      <SubHeader title={t('Mensagem de retorno')} onBack={onBack} />
      <Card>
        <CardText>{t('É a mensagem do botão "Enviar mensagem de retorno", no app e no teclado.')}</CardText>
        <TextInput
          testID="followup-input"
          style={styles.input}
          value={text}
          onChangeText={setText}
          // Só acompanha o cursor (controlar a seleção atrapalha a digitação no Android)
          onSelectionChange={e => setSelection(e.nativeEvent.selection)}
          multiline
          placeholder={t('Escreva a mensagem')}
          placeholderTextColor={colors.textMuted}
        />
        <Button testID="followup-insert-name" label={t('Inserir nome do cliente')} variant="secondary" icon="clientes" onPress={insertClientName} />
        <Text style={styles.hint}>{t('{{cliente}} vira o primeiro nome de cada cliente na hora de enviar.')}</Text>
      </Card>

      <Card>
        <CardTitle>{t('Prévia')}</CardTitle>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{preview}</Text>
        </View>
      </Card>

      <Button testID="followup-save" label={t('Salvar')} onPress={save} disabled={!text.trim()} />
      <Button label={t('Voltar à mensagem padrão')} variant="secondary" onPress={() => setText(defaultFollowUp(segment))} />
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
    ...typography.body,
  },
  hint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    padding: spacing.md,
  },
  bubbleText: { ...typography.body, color: colors.text },
}));
